import { listDocuments } from "./documents.ts";
import { courses } from "./office.ts";
import type { DocRecord, Kind } from "./types.ts";

const pad = (n: number) => String(n).padStart(2, "0");

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// Kinds where a course and chapter hold exactly one line of versions.
const SINGLE_LINE: Kind[] = ["syllabus", "deck", "materials", "quiz", "book"];
const COURSE_WIDE: Kind[] = ["syllabus", "book"];

function folderFor(course: string, chapter: number | null): string {
  if (course === "OFFICE") return "documents/OFFICE";
  return chapter === null ? `documents/${course}/course` : `documents/${course}/chapter-${pad(chapter)}`;
}

function stemFor(course: string, chapter: number | null, kind: Kind, title: string): string {
  const usesSlug = course === "OFFICE" || !SINGLE_LINE.includes(kind);
  const slug = usesSlug ? slugify(title) || kind : kind;
  return `${course}${course !== "OFFICE" && chapter !== null ? `-ch${pad(chapter)}` : ""}-${slug}`;
}

// Where a filed document belongs, given its record. Used to move the file when the record is edited.
export function canonicalPath(doc: DocRecord): string {
  const extension = doc.path.includes(".") ? doc.path.slice(doc.path.lastIndexOf(".")) : "";
  const chapter = doc.course === "OFFICE" || COURSE_WIDE.includes(doc.kind) ? null : doc.chapter;
  // Office and free-form documents keep the name they were filed under.
  if (doc.course === "OFFICE" || !SINGLE_LINE.includes(doc.kind)) {
    return `${folderFor(doc.course, chapter)}/${doc.path.slice(doc.path.lastIndexOf("/") + 1)}`;
  }
  return `${folderFor(doc.course, chapter)}/${stemFor(doc.course, chapter, doc.kind, doc.title)}-v${doc.version}${extension}`;
}

export type FilingInput = { course: string; chapter: number | null; kind: Kind; title?: string; extension?: string };

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

// "Where does this go?" - one answer for a given course, chapter and kind,
// so two people filing the same thing always end up in the same place.
export function adviseFiling(input: FilingInput): FilingAdvice {
  const notes: string[] = [];
  const isOffice = input.course === "OFFICE";
  const course = courses().find((c) => c.id === input.course);
  let chapter = input.chapter;

  if (COURSE_WIDE.includes(input.kind) && chapter !== null) {
    chapter = null;
    notes.push(`A ${input.kind} belongs to the whole course, so it is filed without a chapter.`);
  }
  if (isOffice) chapter = null;
  if (!isOffice && !COURSE_WIDE.includes(input.kind) && chapter === null && SINGLE_LINE.includes(input.kind)) {
    notes.push(`A ${input.kind} is filed under a chapter. Pick the chapter it teaches.`);
  }
  if (course && chapter !== null && !course.chapters.some((c) => c.number === chapter)) {
    notes.push(`${course.id} has no Chapter ${chapter} in its course list. Check the syllabus before filing.`);
  }

  const usesSlug = isOffice || !SINGLE_LINE.includes(input.kind);
  const folder = folderFor(input.course, chapter);
  const stem = stemFor(input.course, chapter, input.kind, input.title ?? "");

  const line = listDocuments({ course: input.course })
    .filter((d) => d.kind === input.kind && d.chapter === chapter)
    .filter((d) => !usesSlug || d.id.replace(/-v\d+$/, "") === stem.toLowerCase())
    .sort((a, b) => b.version - a.version);
  const version = (line[0]?.version ?? 0) + 1;
  const replaces = line.find((d) => d.status === "current") ?? null;

  if (replaces) notes.push(`Version ${replaces.version} is current now. Filing this as current will mark it superseded, never deleted.`);
  else if (line.length) notes.push(`Earlier versions exist but none is current. This becomes version ${version}.`);
  else notes.push("Nothing is filed here yet. This becomes version 1.");
  if (input.kind === "quiz") notes.push("Keep the answer key in the same file, under its own heading, so the office copy is complete.");

  const extension = (input.extension ?? "md").replace(/^\./, "").toLowerCase();
  const fileName = `${stem}-v${version}.${extension}`;
  return {
    folder,
    fileName,
    path: `${folder}/${fileName}`,
    id: `${stem}-v${version}`.toLowerCase(),
    version,
    chapter,
    replaces,
    earlier: line,
    notes,
  };
}
