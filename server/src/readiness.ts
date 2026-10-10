import type { Course, DocRecord } from "./types.ts";

// Accreditation readiness is plain counting. No model is involved, so it is
// the same answer every time and can be checked by hand.

export const REQUIRED_CHAPTER_KINDS = ["deck", "materials", "quiz"] as const;

export type SlotState = "current" | "draft" | "superseded" | "missing";

export type Slot = {
  course: string;
  chapter: number | null;
  chapterTitle: string | null;
  kind: "syllabus" | "deck" | "materials" | "quiz";
  state: SlotState;
  docId: string | null;
  version: number | null;
  // Set when more than one document claims to be the current one.
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

export type Readiness = {
  present: number;
  required: number;
  score: number;
  courses: CourseReadiness[];
};

function slotFor(docs: DocRecord[], course: Course, chapter: number | null, chapterTitle: string | null, kind: Slot["kind"]): Slot {
  const inSlot = docs
    .filter((d) => d.course === course.id && d.chapter === chapter && d.kind === kind)
    .sort((a, b) => b.version - a.version);
  const current = inSlot.filter((d) => d.status === "current");
  const pick = current[0] ?? inSlot.find((d) => d.status === "draft") ?? inSlot.find((d) => d.status === "superseded");
  const state: SlotState = current.length ? "current" : pick ? (pick.status as SlotState) : "missing";
  return {
    course: course.id,
    chapter,
    chapterTitle,
    kind,
    state,
    docId: pick?.id ?? null,
    version: pick?.version ?? null,
    duplicates: current.length > 1 ? current.map((d) => d.id) : [],
  };
}

export function scoreOf(present: number, required: number): number {
  return required === 0 ? 100 : Math.round((present / required) * 100);
}

export function computeReadiness(courses: Course[], docs: DocRecord[]): Readiness {
  const result: CourseReadiness[] = courses.map((course) => {
    const slots: Slot[] = [slotFor(docs, course, null, null, "syllabus")];
    for (const ch of course.chapters) {
      for (const kind of REQUIRED_CHAPTER_KINDS) slots.push(slotFor(docs, course, ch.number, ch.title, kind));
    }
    const present = slots.filter((s) => s.state === "current").length;
    return {
      id: course.id,
      title: course.title,
      term: course.term,
      coordinator: course.coordinator,
      present,
      required: slots.length,
      score: scoreOf(present, slots.length),
      slots,
      gaps: slots.filter((s) => s.state !== "current"),
    };
  });
  const present = result.reduce((n, c) => n + c.present, 0);
  const required = result.reduce((n, c) => n + c.required, 0);
  return { present, required, score: scoreOf(present, required), courses: result };
}
