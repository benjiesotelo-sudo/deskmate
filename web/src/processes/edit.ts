import type { OfficeProcess } from "./types";

// The rules of the process editor, kept apart from the screen so they can be tested.

export const NEW_PREFIX = "new-step-";

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "step"
  );
}

// Steps added here carry a temporary id until they are saved; give them a readable one.
export function finaliseIds(process: OfficeProcess): OfficeProcess {
  const used = new Set(process.steps.filter((step) => !step.id.startsWith(NEW_PREFIX)).map((step) => step.id));
  const renamed = new Map<string, string>();
  for (const step of process.steps) {
    if (!step.id.startsWith(NEW_PREFIX)) continue;
    const base = slug(step.title);
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    renamed.set(step.id, id);
  }
  return {
    ...process,
    steps: process.steps.map((step) => ({
      ...step,
      id: renamed.get(step.id) ?? step.id,
      title: step.title.trim(),
      next: step.next.map((id) => renamed.get(id) ?? id),
    })),
  };
}

export function problemsOf(process: OfficeProcess): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const starts = process.steps.filter((step) => step.kind === "start");
  if (process.steps.length === 0) errors.push("A process needs at least one step.");
  if (starts.length === 0 && process.steps.length > 0) errors.push("Mark one step as the start.");
  if (starts.length > 1) errors.push("Only one step can be the start.");
  for (const step of process.steps) {
    const name = step.title.trim() || "An untitled step";
    if (!step.title.trim()) errors.push("Every step needs a title.");
    if (!step.actor) errors.push(`"${name}" needs someone to do it.`);
    if (step.kind !== "end" && step.next.length === 0) warnings.push(`"${name}" leads nowhere. Link it to a next step or make it an end.`);
    if (step.kind === "decision" && step.next.length === 1) warnings.push(`"${name}" is a decision with only one way out.`);
  }
  const linked = new Set(process.steps.flatMap((step) => step.next));
  for (const step of process.steps) {
    if (step.kind !== "start" && !linked.has(step.id)) warnings.push(`Nothing leads to "${step.title.trim() || "an untitled step"}" yet.`);
  }
  return { errors: Array.from(new Set(errors)), warnings };
}
