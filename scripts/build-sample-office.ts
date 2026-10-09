// Builds data/sample-office from the invented content in this folder.
// Run with: npm run samples
// The output is committed, so judges never need to run this.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { TERM, courses, people, slotFormats, slotOverrides, type ChapterSeed, type CourseSeed } from "./sample-content.ts";
import { processes } from "./sample-processes.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "sample-office");
const OFFICE_NAME = "Deskmate Demo Office";

type Kind = "syllabus" | "materials" | "quiz" | "deck" | "book" | "process" | "other";
type Status = "draft" | "current" | "superseded";

type DocRecord = {
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

const records: DocRecord[] = [];
const files: { rel: string; markdown: string; format: "md" | "pdf" | "docx" }[] = [];
let dayCounter = 0;

function nextDate(): string {
  const base = Date.UTC(2026, 7, 3, 1, 0, 0);
  const d = new Date(base + dayCounter * 36 * 3600 * 1000);
  dayCounter += 1;
  return d.toISOString();
}

const pad = (n: number) => String(n).padStart(2, "0");
const personName = (id: string) => people.find((p) => p.id === id)?.name ?? id;

function folderFor(course: string, chapter: number | null): string {
  if (course === "OFFICE") return "documents/OFFICE";
  return chapter === null ? `documents/${course}/course` : `documents/${course}/chapter-${pad(chapter)}`;
}

function baseName(course: string, chapter: number | null, slug: string, version: number): string {
  const middle = course === "OFFICE" ? "" : chapter === null ? "" : `-ch${pad(chapter)}`;
  return `${course}${middle}-${slug}-v${version}`;
}

function addDoc(opts: {
  course: string;
  chapter: number | null;
  kind: Kind;
  slug?: string;
  title: string;
  owner: string;
  version: number;
  status: Status;
  markdown: string;
  format?: "md" | "pdf" | "docx";
}) {
  const format = opts.format ?? "md";
  const name = baseName(opts.course, opts.chapter, opts.slug ?? opts.kind, opts.version);
  const rel = `${folderFor(opts.course, opts.chapter)}/${name}.${format}`;
  records.push({
    id: name.toLowerCase(),
    title: opts.title,
    kind: opts.kind,
    course: opts.course,
    term: TERM,
    chapter: opts.chapter,
    owner: opts.owner,
    version: opts.version,
    status: opts.status,
    path: rel,
    updatedAt: nextDate(),
  });
  files.push({ rel, markdown: opts.markdown, format });
}

// ---------- content renderers ----------

function syllabusMd(c: CourseSeed, version: number): string {
  const lines = [
    `# ${c.id} ${c.title} - Course Syllabus`,
    "",
    `Office: ${OFFICE_NAME}`,
    `Term: ${TERM}`,
    `Course coordinator: ${personName(c.coordinator)}`,
    `Syllabus version: ${version}`,
    "",
    "## Course description",
    "",
    c.description,
    "",
    "## Learning outcomes",
    "",
    ...c.outcomes.map((o, i) => `${i + 1}. ${o}`),
    "",
    "## Schedule",
    "",
    ...c.chapters.flatMap((ch) => [
      `- Weeks ${ch.number * 3 - 2} to ${ch.number * 3}: Chapter ${ch.number}, ${ch.title}. Quiz ${ch.number} is given on the Friday of week ${ch.number * 3}.`,
    ]),
    "",
    "## Grading",
    "",
    ...c.grading.map(([item, weight]) => `- ${item}: ${weight}`),
    "",
    "## Required textbook",
    "",
    `${c.book.title}, ${c.book.edition}, ${c.book.publisher}.`,
    "",
    "## Course policies",
    "",
    "- Each chapter quiz has a 20 minute limit and one attempt.",
    "- A missed quiz may be taken within one week with a note from the coordinator.",
    version > 1
      ? "- Revised this term: quizzes moved from Monday to the Friday of the third week of each chapter."
      : "- Quizzes are released by the office following the 'Release a quiz' process.",
    "- Decks and readings for each chapter are filed in the office cabinet before the chapter begins.",
  ];
  return lines.join("\n") + "\n";
}

function deckMd(c: CourseSeed, ch: ChapterSeed, version: number): string {
  const lines = [
    `# ${c.id} Chapter ${ch.number}: ${ch.title} - Lecture Deck`,
    "",
    `Term: ${TERM}. Deck version ${version}. Prepared by ${personName(c.coordinator)}.`,
    "",
    "## Slide 1 - Why this chapter matters",
    "",
    ch.summary,
    "",
    ...ch.points.flatMap(([title, text], i) => [`## Slide ${i + 2} - ${title}`, "", text, ""]),
    `## Slide ${ch.points.length + 2} - Key terms`,
    "",
    ...ch.terms.map(([term, def]) => `- **${term}**: ${def}`),
    "",
    `## Slide ${ch.points.length + 3} - Worked example`,
    "",
    ch.example,
    "",
    `## Slide ${ch.points.length + 4} - Before next meeting`,
    "",
    `Read the Chapter ${ch.number} reading notes and prepare for Quiz ${ch.number}.`,
  ];
  if (version > 1) lines.push("", "Revision note: the worked example was moved after the key terms following first-week feedback.");
  return lines.join("\n") + "\n";
}

function materialsMd(c: CourseSeed, ch: ChapterSeed, version: number, draft: boolean): string {
  const lines = [
    `# ${c.id} Chapter ${ch.number}: ${ch.title} - Reading Notes`,
    "",
    `Term: ${TERM}. Materials version ${version}.${draft ? " DRAFT - not yet approved for class use." : ""}`,
    "",
    "## Overview",
    "",
    ch.summary,
    "",
    "## Main ideas",
    "",
    ...ch.points.flatMap(([title, text]) => [`### ${title}`, "", text, ""]),
    "## Key terms",
    "",
    ...ch.terms.map(([term, def]) => `- **${term}**: ${def}`),
    "",
    "## Worked example",
    "",
    ch.example,
    "",
    "## Practice",
    "",
    ...ch.quiz.slice(0, 2).map(([q], i) => `${i + 1}. ${q}`),
  ];
  if (draft) lines.push("", "Still to add: two further readings promised by the coordinator.");
  return lines.join("\n") + "\n";
}

function quizMd(c: CourseSeed, ch: ChapterSeed, version: number): string {
  const lines = [
    `# ${c.id} Quiz ${ch.number}: ${ch.title}`,
    "",
    `Term: ${TERM}. Quiz version ${version}. Time limit: 20 minutes. One attempt.`,
    "",
    "## Items",
    "",
    ...ch.quiz.map(([q], i) => `${i + 1}. ${q}`),
    "",
    "## Answer key (office copy, do not release)",
    "",
    ...ch.quiz.map(([, a], i) => `${i + 1}. ${a}`),
    "",
    "## Release",
    "",
    `This quiz is released on the Friday of week ${ch.number * 3}, following the 'Release a quiz' process. The coordinator checks the answer key before release.`,
  ];
  return lines.join("\n") + "\n";
}

function bookMd(c: CourseSeed): string {
  const lines = [
    `# ${c.id} Textbook Record: ${c.book.title}`,
    "",
    `- Title: ${c.book.title}`,
    `- Author: ${c.book.author}`,
    `- Edition: ${c.book.edition}`,
    `- Publisher: ${c.book.publisher}`,
    `- Used in: ${c.id} ${c.title}, ${TERM}`,
    "",
    "## Chapter mapping",
    "",
    ...c.chapters.map((ch) => `- Course Chapter ${ch.number}, ${ch.title}: textbook unit ${ch.number}.`),
    "",
    "## Notes",
    "",
    c.book.note,
  ];
  return lines.join("\n") + "\n";
}

// ---------- course documents ----------

for (const c of courses) {
  const syl = slotOverrides[`${c.id}:syllabus`]?.state;
  const sylFormat = slotFormats[`${c.id}:syllabus`];
  const sylTitle = `${c.id} Course Syllabus`;
  if (syl === "revised") {
    addDoc({ course: c.id, chapter: null, kind: "syllabus", title: sylTitle, owner: c.coordinator, version: 1, status: "superseded", markdown: syllabusMd(c, 1) });
    addDoc({ course: c.id, chapter: null, kind: "syllabus", title: sylTitle, owner: c.coordinator, version: 2, status: "current", markdown: syllabusMd(c, 2), format: sylFormat });
  } else if (syl !== "missing") {
    addDoc({
      course: c.id,
      chapter: null,
      kind: "syllabus",
      title: sylTitle,
      owner: c.coordinator,
      version: 1,
      status: syl === "draft" ? "draft" : "current",
      markdown: syllabusMd(c, 1),
      format: sylFormat,
    });
  }

  addDoc({ course: c.id, chapter: null, kind: "book", title: `${c.id} Textbook Record - ${c.book.title}`, owner: "bea", version: 1, status: "current", markdown: bookMd(c) });

  for (const ch of c.chapters) {
    for (const kind of ["deck", "materials", "quiz"] as const) {
      const key = `${c.id}:${ch.number}:${kind}`;
      const state = slotOverrides[key]?.state ?? "current";
      const format = slotFormats[key];
      const label = kind === "deck" ? "Lecture Deck" : kind === "materials" ? "Reading Notes" : "Quiz";
      const title = `${c.id} Chapter ${ch.number} ${label} - ${ch.title}`;
      const render = (v: number, draft = false) =>
        kind === "deck" ? deckMd(c, ch, v) : kind === "materials" ? materialsMd(c, ch, v, draft) : quizMd(c, ch, v);
      if (state === "missing") continue;
      if (state === "revised") {
        addDoc({ course: c.id, chapter: ch.number, kind, title, owner: c.coordinator, version: 1, status: "superseded", markdown: render(1) });
        addDoc({ course: c.id, chapter: ch.number, kind, title, owner: c.coordinator, version: 2, status: "current", markdown: render(2), format });
        continue;
      }
      addDoc({
        course: c.id,
        chapter: ch.number,
        kind,
        title,
        owner: c.coordinator,
        version: 1,
        status: state === "draft" ? "draft" : state === "superseded-only" ? "superseded" : "current",
        markdown: render(1, state === "draft"),
        format,
      });
    }
  }
}

// ---------- office-wide documents ----------

addDoc({
  course: "OFFICE",
  chapter: null,
  kind: "process",
  slug: "filing-guide",
  title: "Filing and Naming Guide",
  owner: "marisol",
  version: 1,
  status: "current",
  markdown: `# Filing and Naming Guide

This guide decides where every document in the ${OFFICE_NAME} goes and what it is called.
It exists so that the cabinet looks the same no matter who filed last.

## The three facts

Every document is filed by three facts: the course, the chapter, and the kind.
The kinds are syllabus, deck, materials, quiz, book, process and other.
A syllabus and a book record belong to the whole course, so they have no chapter.

## Where it goes

- Course-wide documents go in documents/COURSE/course.
- Chapter documents go in documents/COURSE/chapter-NN, with a two digit chapter number.
- Office documents that are not about one course go in documents/OFFICE.

## What it is called

The file name pattern is COURSE-chNN-kind-vN.
Example: BUS101-ch01-deck-v2 is the second version of the Chapter 1 deck for BUS101.
Course-wide documents leave out the chapter part, for example FIN201-syllabus-v1.

## Versions and status

- draft: being written or waiting for approval. A draft never counts toward readiness.
- current: the one version in use this term. There is only ever one current document per course, chapter and kind.
- superseded: an older version kept for the record. Superseded documents are never deleted.

When a revision arrives, the old version becomes superseded first, then the new one is filed as current with the next version number.

## Who owns it

The owner of a course document is the course coordinator.
The owner of an office document is the person who keeps it up to date.
Ownership changes only through the staff turnover handover process.
`,
});

addDoc({
  course: "OFFICE",
  chapter: null,
  kind: "process",
  slug: "quiz-release-checklist",
  title: "Quiz Release Checklist",
  owner: "bea",
  version: 1,
  status: "current",
  markdown: `# Quiz Release Checklist

Use this checklist every time a chapter quiz is released. It goes with the 'Release a quiz' process.

## Five working days before

- [ ] The quiz in the cabinet is marked current, not draft and not superseded.
- [ ] The coordinator has answered every item and confirmed the answer key.
- [ ] The quiz date matches the schedule in the current syllabus.

## When scheduling on the learning platform

- [ ] Opens at the class start time on the syllabus date.
- [ ] Time limit is 20 minutes.
- [ ] One attempt only.
- [ ] Answers stay hidden until the quiz closes.
- [ ] The answer key section is not copied into the student view.

## Two days before

- [ ] Reminder posted with chapter, date, time limit and coverage.

## After it closes

- [ ] The coordinator exports the results summary.
- [ ] The results summary is filed under the same course and chapter as kind 'other'.

## Worked example

FIN201 Quiz 1, Budgeting and Cash Flow: key confirmed Monday, scheduled for Friday 9:00 am, reminder posted Wednesday, results filed the following Monday with a class average of 3.1 out of 4.
`,
});

addDoc({
  course: "OFFICE",
  chapter: null,
  kind: "process",
  slug: "accreditation-evidence-list",
  title: "Accreditation Evidence List",
  owner: "marisol",
  version: 1,
  status: "current",
  markdown: `# Accreditation Evidence List

This list states what the ${OFFICE_NAME} must be able to show for every course when accreditors visit.

## Required for every course

1. A current syllabus for the term.
2. For every chapter in the syllabus: a current lecture deck.
3. For every chapter in the syllabus: current reading materials.
4. For every chapter in the syllabus: a current quiz with its answer key.

A document counts only when it is filed in the cabinet and its status is current.
Drafts and superseded versions do not count.

## Also kept, not scored

- The textbook record for the course.
- Superseded versions from earlier terms.
- Quiz results summaries.

## How readiness is scored

Readiness for a course is the number of required documents that are current, divided by the number required.
A course with four chapters requires 13 documents: one syllabus and three documents for each chapter.

## Sign-off

The Department Chair signs this list once every course is at 100 percent.
Any exception is written here with the date and the person responsible.
`,
});

addDoc({
  course: "OFFICE",
  chapter: null,
  kind: "process",
  slug: "handover-template",
  title: "Staff Handover Template",
  owner: "marisol",
  version: 1,
  status: "current",
  format: "docx",
  markdown: `# Staff Handover Template

Fill in one copy for every person who leaves or changes role. File the signed copy under OFFICE.

## Person handing over

Name, role, last working day.

## Documents owned

List every document from the directory whose owner is this person. For each one, write the successor.

## Processes owned

List every process this person owns or performs a step in. For each one, write the successor and the date they performed it once themselves.

## Drafts in progress

For each draft, write what is missing, who is waiting for it, and when it is due.

## Things that are not written down anywhere

Passwords are never written here. Write where to find things, who to ask, and what usually goes wrong.

## Sign-off

Outgoing staff, successor, and the Office Administrator sign and date.
A check-in is held one week after the last working day.
`,
});

addDoc({
  course: "OFFICE",
  chapter: null,
  kind: "other",
  slug: "welcome-guide",
  title: "Welcome Guide for New Staff",
  owner: "marisol",
  version: 1,
  status: "current",
  markdown: `# Welcome Guide for New Staff

Welcome to the ${OFFICE_NAME}. This page is the first thing to read in your first week.

## What this office does

The office supports three courses this term: BUS101 Foundations of Business, FIN201 Personal Finance Basics, and MKT150 Principles of Marketing.
For each course we keep the syllabus, the decks, the reading materials, the quizzes and the textbook record, and we make sure they agree with each other.

## Who to ask

- Marisol Dantes, Office Administrator: filing, handovers, anything about how the office runs.
- Celso Marquez, Department Chair: approvals and accreditation sign-off.
- Rafael Ignacio: BUS101.
- Lourdes Abad: FIN201. Lourdes works from home on most days, so message her first.
- Jomar Velez: MKT150.

## Your first week

1. Sign in to Deskmate and open the cabinet. Browse one course from syllabus to quiz.
2. Read the Filing and Naming Guide.
3. Ask Tams how to file new course material, then watch the process in the office view.
4. File one real document with Marisol watching.
5. Open the readiness screen and find one gap you could help close.

## Office hours

The office is open Monday to Friday, 8:00 am to 5:00 pm. Quizzes are released on Fridays.
`,
});

// ---------- writers ----------

type Block = { type: "h1" | "h2" | "h3" | "p" | "li"; text: string };

function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const clean = (s: string) => s.replace(/\*\*/g, "");
    if (line.startsWith("### ")) blocks.push({ type: "h3", text: clean(line.slice(4)) });
    else if (line.startsWith("## ")) blocks.push({ type: "h2", text: clean(line.slice(3)) });
    else if (line.startsWith("# ")) blocks.push({ type: "h1", text: clean(line.slice(2)) });
    else if (/^(- |\d+\. )/.test(line)) blocks.push({ type: "li", text: clean(line) });
    else blocks.push({ type: "p", text: clean(line) });
  }
  return blocks;
}

async function writePdf(file: string, markdown: string) {
  const fixed = new Date(Date.UTC(2026, 7, 1));
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(fixed);
  pdf.setModificationDate(fixed);
  pdf.setProducer("Deskmate sample office builder");
  pdf.setCreator("Deskmate");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 64;
  const width = 595;
  const height = 842;
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const draw = (text: string, size: number, font: typeof regular, gapAfter: number) => {
    const words = text.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > width - margin * 2) {
        lines.push(line);
        line = w;
      } else line = trial;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      if (y < margin + size) {
        page = pdf.addPage([width, height]);
        y = height - margin;
      }
      page.drawText(l, { x: margin, y, size, font, color: rgb(0.11, 0.1, 0.09) });
      y -= size * 1.45;
    }
    y -= gapAfter;
  };
  for (const b of toBlocks(markdown)) {
    if (b.type === "h1") draw(b.text, 18, bold, 10);
    else if (b.type === "h2") {
      y -= 6;
      draw(b.text, 13, bold, 4);
    } else if (b.type === "h3") draw(b.text, 11.5, bold, 2);
    else draw(b.text, 10.5, regular, b.type === "li" ? 1 : 5);
  }
  fs.writeFileSync(file, await pdf.save());
}

async function writeDocx(file: string, markdown: string) {
  const children = toBlocks(markdown).map((b) => {
    if (b.type === "h1") return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(b.text)] });
    if (b.type === "h2") return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.text)] });
    if (b.type === "h3") return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(b.text)] });
    return new Paragraph({ children: [new TextRun(b.text)] });
  });
  const doc = new Document({ creator: "Deskmate", title: "Deskmate sample document", sections: [{ children }] });
  fs.writeFileSync(file, await Packer.toBuffer(doc));
}

fs.rmSync(path.join(outDir, "documents"), { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const f of files) {
  const abs = path.join(outDir, f.rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (f.format === "md") fs.writeFileSync(abs, f.markdown);
  else if (f.format === "pdf") await writePdf(abs, f.markdown);
  else await writeDocx(abs, f.markdown);
}

const json = (name: string, value: unknown) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2) + "\n");

json("office.json", { name: OFFICE_NAME, term: TERM, note: "An invented office. Every person, course and document here is sample data." });
json(
  "courses.json",
  courses.map((c) => ({
    id: c.id,
    title: c.title,
    term: TERM,
    coordinator: c.coordinator,
    chapters: c.chapters.map((ch) => ({ number: ch.number, title: ch.title })),
  })),
);
json("processes.json", processes);
json("documents.json", records);
json(
  "people.json",
  people.map((p) => ({
    ...p,
    owns: {
      documents: records.filter((r) => r.owner === p.id).map((r) => r.id),
      processes: processes.filter((pr) => pr.owner === p.id).map((pr) => pr.id),
    },
  })),
);

// Guard against dangling references before anything is committed.
const docIds = new Set(records.map((r) => r.id));
const personIds = new Set(people.map((p) => p.id));
for (const pr of processes) {
  if (!personIds.has(pr.owner)) throw new Error(`process ${pr.id}: unknown owner ${pr.owner}`);
  const stepIds = new Set(pr.steps.map((s) => s.id));
  for (const s of pr.steps) {
    if (!personIds.has(s.actor)) throw new Error(`process ${pr.id} step ${s.id}: unknown actor ${s.actor}`);
    if (s.artifact && !docIds.has(s.artifact)) throw new Error(`process ${pr.id} step ${s.id}: unknown artifact ${s.artifact}`);
    for (const n of s.next) if (!stepIds.has(n)) throw new Error(`process ${pr.id} step ${s.id}: unknown next ${n}`);
  }
}

console.log(`Wrote ${records.length} documents, ${people.length} people, ${processes.length} processes to data/sample-office`);
