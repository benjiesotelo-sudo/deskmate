import { useEffect, useSyncExternalStore } from "react";
import type { OfficeProcess, Person } from "./types";

// Loads people and processes from deskmate-core's API, and falls back to the bundled sample
// office (/sample/*.json) only when the API is not there at all. A refused or failing API
// is reported as an error, never papered over with sample data.

export type Source = "api" | "sample";

export type OfficeData = {
  people: Person[];
  processes: OfficeProcess[];
  documentTitles: Record<string, string>;
  source: { people: Source; processes: Source };
  localEdits: string[]; // process ids whose edits live in this browser only
};

export type OfficeState =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: OfficeData; error?: undefined }
  | { status: "error"; data?: undefined; error: string };

class ApiAbsent extends Error {}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiAbsent(`${url} is not reachable`);
  }
  if (response.status === 404 || response.status === 405) throw new ApiAbsent(`${url} is not served`);
  if (response.status === 401 || response.status === 403) throw new Error("Sign in to see the office.");
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  // A dev server answers unknown paths with the app's HTML page: that is "no API", not data.
  if (!(response.headers.get("content-type") ?? "").includes("json")) throw new ApiAbsent(`${url} is not JSON`);
  return response.json();
}

function asList<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  const wrapped = (value as Record<string, unknown> | null)?.[key];
  if (Array.isArray(wrapped)) return wrapped as T[];
  throw new Error(`Expected a list of ${key}`);
}

async function withFallback<T>(apiUrl: string, sampleUrl: string, key: string): Promise<{ list: T[]; source: Source }> {
  try {
    return { list: asList<T>(await getJson(apiUrl), key), source: "api" };
  } catch (error) {
    if (!(error instanceof ApiAbsent)) throw error;
    return { list: asList<T>(await getJson(sampleUrl), key), source: "sample" };
  }
}

// Document titles are a nicety for labels; ids are shown when they cannot be loaded.
async function loadDocumentTitles(): Promise<Record<string, string>> {
  try {
    const { list } = await withFallback<{ id?: string; title?: string; name?: string; version?: number; status?: string }>(
      "/api/documents",
      "/sample/documents.json",
      "documents",
    );
    const titles: Record<string, string> = {};
    for (const doc of list) {
      if (!doc.id) continue;
      // Two versions of one document share a title, so the version is part of the label.
      const notes = [doc.version ? `v${doc.version}` : "", doc.status === "superseded" ? "superseded" : ""].filter(Boolean);
      titles[doc.id] = `${doc.title ?? doc.name ?? doc.id}${notes.length > 0 ? ` (${notes.join(", ")})` : ""}`;
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
const listeners = new Set<() => void>();

function setState(next: OfficeState) {
  state = next;
  for (const listener of listeners) listener();
}

export function loadOffice(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = (async () => {
    try {
      const [people, processes, documentTitles] = await Promise.all([
        withFallback<Person>("/api/people", "/sample/people.json", "people"),
        withFallback<OfficeProcess>("/api/processes", "/sample/processes.json", "processes"),
        loadDocumentTitles(),
      ]);
      // Edits that could not reach the server are kept in this browser and laid over what loads.
      const local = readLocal();
      const localEdits = processes.list.filter((process) => local[process.id]).map((process) => process.id);
      const list = processes.list.map((process) => local[process.id] ?? process);
      setState({
        status: "ready",
        data: {
          people: people.list,
          processes: list,
          documentTitles,
          source: { people: people.source, processes: processes.source },
          localEdits,
        },
      });
    } catch (error) {
      setState({ status: "error", error: error instanceof Error ? error.message : "The office could not be loaded." });
    }
  })();
  return loading;
}

export type SaveResult = { where: "server" | "browser" };

// PUT /api/processes/:id. If the server has no such route or cannot be reached, the edit is
// kept in this browser instead and the caller is told so, so the screen can say it plainly.
export async function saveProcess(process: OfficeProcess): Promise<SaveResult> {
  if (state.status !== "ready") throw new Error("The office has not loaded yet.");
  const data = state.data;
  let response: Response | null = null;
  try {
    response = await fetch(`/api/processes/${encodeURIComponent(process.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(process),
    });
  } catch {
    response = null;
  }
  // 404 or 405 on the PUT means this server has no save route for processes (yet).
  const absent = response === null || response.status === 404 || response.status === 405;
  if (!absent && response && !response.ok) {
    let reason = `The server answered ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      reason = body.error ?? body.message ?? reason;
    } catch {
      // keep the status text
    }
    throw new Error(reason);
  }

  let saved = process;
  let where: SaveResult["where"] = "server";
  if (absent) {
    where = "browser";
    writeLocal({ ...readLocal(), [process.id]: process });
  } else if (response) {
    // The server has it now, so any copy kept in this browser is out of date.
    const local = readLocal();
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
  const localEdits =
    where === "browser" ? Array.from(new Set([...data.localEdits, process.id])) : data.localEdits.filter((id) => id !== process.id);
  setState({
    status: "ready",
    data: { ...data, processes: data.processes.map((item) => (item.id === saved.id ? saved : item)), localEdits },
  });
  return { where };
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
  useEffect(() => {
    void loadOffice();
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
