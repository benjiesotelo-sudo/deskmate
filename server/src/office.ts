import fs from "node:fs";
import path from "node:path";
import { MIRROR_DIR, OFFICE_DIR, SAMPLE_OFFICE_DIR } from "./config.ts";
import type { Course, OfficeProcess, Person } from "./types.ts";

// The app never edits data/sample-office. It works on a copy in data/office,
// so the repo stays clean and "reset the demo" is just a fresh copy.
export function ensureOfficeCopy(reset = false) {
  if (reset) fs.rmSync(OFFICE_DIR, { recursive: true, force: true });
  if (!fs.existsSync(path.join(OFFICE_DIR, "documents.json"))) {
    fs.mkdirSync(OFFICE_DIR, { recursive: true });
    fs.cpSync(SAMPLE_OFFICE_DIR, OFFICE_DIR, { recursive: true });
  }
}

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(OFFICE_DIR, name), "utf8")) as T;
}

export const office = () => readJson<{ name: string; term: string; note?: string }>("office.json");
export const peopleFile = () => readJson<Person[]>("people.json");
export const courses = () => readJson<Course[]>("courses.json");
export const processes = () => readJson<OfficeProcess[]>("processes.json");

// Replace one process in the working copy. Written to a temporary file first, so a crash
// halfway through never leaves a half-written processes.json behind.
export function writeProcess(process: OfficeProcess) {
  const next = processes().map((p) => (p.id === process.id ? process : p));
  const file = path.join(OFFICE_DIR, "processes.json");
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2) + "\n");
  fs.renameSync(`${file}.tmp`, file);
}

// Resolve a document path inside the office folder, refusing anything that escapes it.
// Mirrored documents carry a path that starts with "mirror/" and live in the Drive mirror folder.
export function officePath(rel: string): string {
  if (rel.startsWith("mirror/")) {
    const mirrored = path.resolve(MIRROR_DIR, rel.slice("mirror/".length));
    if (!mirrored.startsWith(MIRROR_DIR + path.sep)) throw new Error("Path leaves the mirror folder");
    return mirrored;
  }
  const abs = path.resolve(OFFICE_DIR, rel);
  if (abs !== OFFICE_DIR && !abs.startsWith(OFFICE_DIR + path.sep)) throw new Error("Path leaves the office folder");
  return abs;
}

export function savePeople(people: Person[]) {
  fs.writeFileSync(path.join(OFFICE_DIR, "people.json"), JSON.stringify(people, null, 2) + "\n");
}
