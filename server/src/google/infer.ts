import type { Course, Kind } from "../types.ts";

export type Inferred = { title: string; kind: Kind; course: string; chapter: number | null };

const words = (text: string) => text.replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

const KIND_WORDS: [Kind, RegExp][] = [
  ["syllabus", /\bsyllab(us|i)\b/i],
  ["quiz", /\b(quiz(zes)?|exams?|midterms?|finals|tests?|assessments?)\b/i],
  ["deck", /\b(decks?|slides?|presentations?)\b/i],
  ["book", /\b(e ?books?|textbooks?|books?)\b/i],
  ["materials", /\b(materials?|readings?|handouts?|notes|worksheets?|case stud(y|ies)|activit(y|ies)|modules?)\b/i],
  ["process", /\b(process(es)?|procedures?|checklists?|sop|guides?|templates?|polic(y|ies)|forms?)\b/i],
];

const SLIDE_TYPES = ["application/vnd.google-apps.presentation", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"];

function courseIn(text: string, courses: Course[]): string | null {
  const flat = compact(text);
  for (const course of courses) {
    if (flat.includes(compact(course.id))) return course.id;
  }
  for (const course of courses) {
    if (flat.includes(compact(course.title))) return course.id;
  }
  return null;
}

function chapterIn(text: string): number | null {
  const match = /\b(?:chapter|chap|ch)\s*0*(\d{1,2})\b/i.exec(words(text));
  return match ? Number(match[1]) : null;
}

function kindIn(text: string): Kind | null {
  const clean = words(text);
  for (const [kind, pattern] of KIND_WORDS) if (pattern.test(clean)) return kind;
  return null;
}

// Work out a filing record from where a file sits in Drive.
// `folders` runs from the connected folder down to the file's own folder.
// Folders are read first, nearest folder first, and the file name settles what they leave open.
export function inferRecord(folders: string[], fileName: string, mime: string, courses: Course[]): Inferred {
  const title = fileName.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim() || fileName;
  const nearestFirst = [...folders].reverse();

  let course: string | null = null;
  for (const folder of nearestFirst) if ((course = courseIn(folder, courses))) break;
  course ??= courseIn(title, courses);

  let chapter: number | null = null;
  for (const folder of nearestFirst) if ((chapter = chapterIn(folder)) !== null) break;
  chapter ??= chapterIn(title);

  // The file name says what a file is more exactly than the folder it sits in.
  let kind = kindIn(title);
  if (!kind && SLIDE_TYPES.includes(mime)) kind = "deck";
  if (!kind) for (const folder of nearestFirst) if ((kind = kindIn(folder))) break;
  if (!kind) kind = course && chapter !== null ? "materials" : "other";

  if (!course) return { title, kind, course: "OFFICE", chapter: null };
  if (kind === "syllabus" || kind === "book") chapter = null;
  return { title, kind, course, chapter };
}

// Accepts a Drive folder link or a bare folder id.
export function parseFolderId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const inPath = /\/folders\/([A-Za-z0-9_-]{6,})/.exec(text);
  if (inPath) return inPath[1];
  const inQuery = /[?&]id=([A-Za-z0-9_-]{6,})/.exec(text);
  if (inQuery) return inQuery[1];
  if (/^[A-Za-z0-9_-]{6,}$/.test(text)) return text;
  return null;
}

// How a Drive file comes down. Google's own formats are exported to a file that opens anywhere.
const EXPORTS: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx" },
  "application/vnd.google-apps.spreadsheet": { mime: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.drawing": { mime: "application/pdf", ext: ".pdf" },
};

export const FOLDER_TYPE = "application/vnd.google-apps.folder";
export const SIDECAR_SUFFIX = ".deskmate.json";

export function exportFor(mime: string): { mime: string; ext: string } | null {
  return EXPORTS[mime] ?? null;
}

// Forms, Sites, Maps, shortcuts and the like have no file to download.
export function staysInDrive(mime: string): boolean {
  return mime.startsWith("application/vnd.google-apps.") && mime !== FOLDER_TYPE && !EXPORTS[mime];
}

// A name that is safe as one path segment on disk.
export function safeName(name: string): string {
  const clean = name.replace(/[\/\\:\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim();
  return clean || "untitled";
}
