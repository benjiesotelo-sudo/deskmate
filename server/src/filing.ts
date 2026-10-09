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
  const slug = usesSlug ? slugify(input.title ?? "") || input.kind : input.kind;
  const folder = isOffice
    ? "documents/OFFICE"
    : chapter === null
      ? `documents/${input.course}/course`
      : `documents/${input.course}/chapter-${pad(chapter)}`;
  const stem = `${input.course}${!isOffice && chapter !== null ? `-ch${pad(chapter)}` : ""}-${slug}`;

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
