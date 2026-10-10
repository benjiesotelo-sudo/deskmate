import { useEffect, useSyncExternalStore } from "react";
import type { OfficeProcess, Person } from "./types";

// Loads people, processes and document titles from the Deskmate API and keeps them in one
// small store shared by the office view and the process pages.

export type OfficeData = {
  people: Person[];
  processes: OfficeProcess[];
  documentTitles: Record<string, string>;
  localEdits: string[]; // process ids whose edits live in this browser only
};

export type OfficeState =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: OfficeData; error?: undefined }
  | { status: "error"; data?: undefined; error: string };

async function getList<T>(url: string): Promise<T[]> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" });
  } catch {
    throw new Error("Deskmate is not responding. Check that the app is still running on this machine.");
  }
  if (response.status === 401) {
    // The same signal the rest of the app uses to go back to the sign-in page.
    window.dispatchEvent(new Event("deskmate:signed-out"));
    throw new Error("Sign in to see the office.");
  }
  if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error(`${url} did not answer with a list.`);
  return value as T[];
}

// Document titles are a nicety for labels; ids are shown when they cannot be loaded.
async function loadDocumentTitles(): Promise<Record<string, string>> {
  try {
    const list = await getList<{ id?: string; title?: string; version?: number; status?: string }>("/api/documents");
    const titles: Record<string, string> = {};
    for (const doc of list) {
      if (!doc.id) continue;
      // Two versions of one document share a title, so the version is part of the label.
      const notes = [doc.version ? `v${doc.version}` : "", doc.status === "superseded" ? "superseded" : ""].filter(Boolean);
      titles[doc.id] = `${doc.title ?? doc.id}${notes.length > 0 ? ` (${notes.join(", ")})` : ""}`;
    }
    return titles;
  } catch {
    return {};
  }
}

const LOCAL_KEY = "deskmate.office.localProcesses";

function readLocal(): Record<string, OfficeProcess> {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, OfficeProcess>;
  } catch {
    return {};
  }
}

function writeLocal(edits: Record<string, OfficeProcess>) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(edits));
  } catch {
    // private browsing or a full disk: the edit still lives in memory for this session
  }
}

let state: OfficeState = { status: "loading" };
let loading: Promise<void> | null = null;
let latest = 0;
const listeners = new Set<() => void>();

function setState(next: OfficeState) {
  state = next;
  for (const listener of listeners) listener();
}

// Loads the office. A reload that brings back exactly what is already on screen changes
// nothing, so a process that is playing is never interrupted by a background refresh.
export function loadOffice(force = false): Promise<void> {
  if (loading && !force) return loading;
  const turn = (latest += 1);
  loading = (async () => {
    try {
      const [people, processes, documentTitles] = await Promise.all([
        getList<Person>("/api/people"),
        getList<OfficeProcess>("/api/processes"),
        loadDocumentTitles(),
      ]);
      if (turn !== latest) return; // a newer load is on its way
      // Edits that could not reach the server are kept in this browser and laid over what loads.
      const local = readLocal();
      const data: OfficeData = {
        people,
        processes: processes.map((process) => local[process.id] ?? process),
        documentTitles,
        localEdits: processes.filter((process) => local[process.id]).map((process) => process.id),
      };
      if (state.status === "ready" && JSON.stringify(state.data) === JSON.stringify(data)) return;
      setState({ status: "ready", data });
    } catch (error) {
      if (turn !== latest) return;
      // Keep showing what is already loaded if a background refresh fails.
      if (state.status === "ready") return;
      setState({ status: "error", error: error instanceof Error ? error.message : "The office could not be loaded." });
    }
  })();
  return loading;
}

export type SaveResult = { where: "server" } | { where: "browser" };

// PUT /api/processes/:id. The server checks the process, stores it and re-reads it for Tams.
// Only when the server cannot be reached at all is the edit kept in this browser instead,
// and the caller is told so, so the screen can say it plainly.
export async function saveProcess(process: OfficeProcess): Promise<SaveResult> {
  if (state.status !== "ready") throw new Error("The office has not loaded yet.");
  let response: Response | null = null;
  try {
    response = await fetch(`/api/processes/${encodeURIComponent(process.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(process),
    });
  } catch {
    response = null;
  }
  if (response && !response.ok) {
    let reason = `The server answered ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: string };
      reason = body.error ?? reason;
    } catch {
      // keep the status text
    }
    if (response.status === 401) window.dispatchEvent(new Event("deskmate:signed-out"));
    throw new Error(reason);
  }

  let saved = process;
  const local = readLocal();
  if (!response) {
    writeLocal({ ...local, [process.id]: process });
  } else {
    // The server has it now, so any copy kept in this browser is out of date.
    if (local[process.id]) {
      delete local[process.id];
      writeLocal(local);
    }
    try {
      const body = (await response.json()) as Partial<OfficeProcess> | null;
      if (body && body.id === process.id && Array.isArray(body.steps)) saved = body as OfficeProcess;
    } catch {
      // an empty answer is fine: what was sent is what was saved
    }
  }
  // Read the store again: a background refresh may have landed while the save was in flight.
  const data = state.data;
  const localEdits = response ? data.localEdits.filter((id) => id !== process.id) : Array.from(new Set([...data.localEdits, process.id]));
  setState({
    status: "ready",
    data: { ...data, processes: data.processes.map((item) => (item.id === saved.id ? saved : item)), localEdits },
  });
  return { where: response ? "server" : "browser" };
}

// Throw away edits kept in this browser and show what the office has on record again.
export async function discardLocalEdits(processId: string): Promise<void> {
  const local = readLocal();
  delete local[processId];
  writeLocal(local);
  await loadOffice(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOffice(): OfficeState {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  // Each screen that opens asks again, so a document filed or handed over a minute ago shows up.
  useEffect(() => {
    void loadOffice(true);
  }, []);
  return snapshot;
}

export function personById(people: Person[], id: string): Person | undefined {
  return people.find((person) => person.id === id);
}

export function firstName(person: Person | undefined, fallback: string): string {
  return person ? (person.name.split(" ")[0] ?? person.name) : fallback;
}

// Everyone who appears in a process, in order of first appearance, owner included.
export function participants(process: OfficeProcess): string[] {
  const ids = [process.owner, ...process.steps.map((step) => step.actor)];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function processesOf(processes: OfficeProcess[], personId: string): Array<{ process: OfficeProcess; owner: boolean; steps: number }> {
  return processes
    .map((process) => ({
      process,
      owner: process.owner === personId,
      steps: process.steps.filter((step) => step.actor === personId).length,
    }))
    .filter((entry) => entry.owner || entry.steps > 0);
}
