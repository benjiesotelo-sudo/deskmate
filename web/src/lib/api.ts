// Types and fetch helpers for the Deskmate API.
// The office and Google modules can import from here instead of re-declaring shapes.

export const KINDS = ["syllabus", "deck", "materials", "quiz", "book", "process", "other"] as const;
export type Kind = (typeof KINDS)[number];
export const STATUSES = ["draft", "current", "superseded"] as const;
export type Status = (typeof STATUSES)[number];

export const KIND_LABEL: Record<Kind, string> = {
  syllabus: "Syllabus",
  deck: "Deck",
  materials: "Materials",
  quiz: "Quiz",
  book: "Book",
  process: "Process",
  other: "Other",
};

export type Me = { id: string; username: string; name: string; role: string; access: "admin" | "staff"; email: string };
export type Office = { name: string; term: string; note?: string };

export type Person = Me & {
  location: "office" | "home";
  desk: { x: number; y: number };
  avatar: { skin: string; hair: string; outfit: string; accessory: string };
  owns: { documents: string[]; processes: string[] };
};

export type Course = { id: string; title: string; term: string; coordinator: string; chapters: { number: number; title: string }[] };

export type ProcessStep = {
  id: string;
  title: string;
  kind: "start" | "task" | "decision" | "end";
  actor: string;
  description: string;
  example: string;
  artifact?: string;
  next: string[];
};

export type OfficeProcess = { id: string; name: string; owner: string; summary: string; trigger: string; example: string; steps: ProcessStep[] };

export type DocRecord = {
  id: string;
  title: string;
  kind: Kind;
  course: string;
  term: string;
  chapter: number | null;
  owner: string;
  version: number;
  status: Status;
  path: string;
  updatedAt: string;
};

export type DocDetail = DocRecord & { text: string; fileName: string; fileExists: boolean; versions: DocRecord[]; canEdit: boolean };

export type FilingAdvice = {
  folder: string;
  fileName: string;
  path: string;
  id: string;
  version: number;
  chapter: number | null;
  replaces: DocRecord | null;
  earlier: DocRecord[];
  notes: string[];
};

export type SlotState = "current" | "draft" | "superseded" | "missing";
export type Slot = {
  course: string;
  chapter: number | null;
  chapterTitle: string | null;
  kind: "syllabus" | "deck" | "materials" | "quiz";
  state: SlotState;
  docId: string | null;
  version: number | null;
  duplicates: string[];
};
export type CourseReadiness = {
  id: string;
  title: string;
  term: string;
  coordinator: string;
  present: number;
  required: number;
  score: number;
  slots: Slot[];
  gaps: Slot[];
};
export type Readiness = { present: number; required: number; score: number; courses: CourseReadiness[] };

export type TamsStatus = {
  local: { reachable: boolean; chatModel: string; chatReady: boolean; embedModel: string; embedReady: boolean };
  cloud: { configured: boolean; online: boolean; available: boolean; model: string };
  index: {
    chunks: number;
    embedded: number;
    documents: number;
    processes: number;
    building: boolean;
    builtAt: string | null;
    search: "empty" | "embeddings" | "partial" | "keywords";
  };
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  let body = init?.body;
  if (init && "json" in init) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Deskmate is not responding. Check that the app is still running on this machine.");
  }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("deskmate:signed-out"));
    throw new ApiError(res.status, (data as { error?: string; message?: string } | null)?.error ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

export function fileLink(slot: { course: string; chapter: number | null; kind: string }): string {
  const q = new URLSearchParams({ course: slot.course, kind: slot.kind });
  if (slot.chapter !== null) q.set("chapter", String(slot.chapter));
  return `/cabinet/file?${q}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
