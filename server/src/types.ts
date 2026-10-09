export const KINDS = ["syllabus", "materials", "quiz", "deck", "book", "process", "other"] as const;
export type Kind = (typeof KINDS)[number];

export const STATUSES = ["draft", "current", "superseded"] as const;
export type Status = (typeof STATUSES)[number];

export type Person = {
  id: string;
  username: string;
  name: string;
  role: string;
  access: "admin" | "staff";
  email: string;
  location: "office" | "home";
  desk: { x: number; y: number };
  avatar: { skin: string; hair: string; outfit: string; accessory: string };
  owns: { documents: string[]; processes: string[] };
};

export type Course = {
  id: string;
  title: string;
  term: string;
  coordinator: string;
  chapters: { number: number; title: string }[];
};

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

export type OfficeProcess = {
  id: string;
  name: string;
  owner: string;
  summary: string;
  trigger: string;
  example: string;
  steps: ProcessStep[];
};

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
  // Set only on documents that came from the connected Drive folder.
  mirrored?: boolean;
  driveFileId?: string | null;
};
