import type { OfficeProcess, Person, ProcessStep } from "./types.ts";

// The rules a process must pass before it is saved. They match what the editor checks on
// screen (web/src/processes/edit.ts), plus the checks only the server can make: every
// person, document and step a process points at has to exist.

const STEP_KINDS = ["start", "task", "decision", "end"] as const;
const MAX_STEPS = 60;
const MAX_LINE = 200;
const MAX_TEXT = 4000;
const STEP_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type ProcessCheck = { process: OfficeProcess } | { error: string; status?: number };

type Context = {
  existing: OfficeProcess;
  person: Pick<Person, "id" | "access">;
  personIds: ReadonlySet<string>;
  documentIds: ReadonlySet<string>;
};

export function canEditProcess(person: Pick<Person, "id" | "access">, process: Pick<OfficeProcess, "owner">): boolean {
  return person.access === "admin" || process.owner === person.id;
}

function line(value: unknown, what: string, required: boolean): { text: string } | { error: string } {
  if (typeof value !== "string") return { error: `${what} must be text.` };
  const text = value.trim();
  if (required && !text) return { error: `${what} cannot be empty.` };
  if (text.length > MAX_LINE) return { error: `${what} is too long. Keep it under ${MAX_LINE} characters.` };
  return { text };
}

function paragraph(value: unknown, what: string): { text: string } | { error: string } {
  if (typeof value !== "string") return { error: `${what} must be text.` };
  const text = value.trim();
  if (text.length > MAX_TEXT) return { error: `${what} is too long. Keep it under ${MAX_TEXT} characters.` };
  return { text };
}

// Reads a whole process as sent by the editor and returns a clean copy with only the
// fields of the data contract, or the first problem as a sentence a person can read.
export function checkProcess(input: unknown, context: Context): ProcessCheck {
  const { existing, person, personIds, documentIds } = context;
  if (!canEditProcess(person, existing)) {
    return { error: "You can change only the processes you own. Ask the process owner or an office admin.", status: 403 };
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Send the whole process as one object." };
  const body = input as Record<string, unknown>;
  if (body.id !== existing.id) return { error: "The process id cannot be changed." };

  const name = line(body.name, "The process name", true);
  if ("error" in name) return name;
  const summary = paragraph(body.summary, "The summary");
  if ("error" in summary) return summary;
  const trigger = paragraph(body.trigger, "What starts the process");
  if ("error" in trigger) return trigger;
  const example = paragraph(body.example, "The real example");
  if ("error" in example) return example;

  if (typeof body.owner !== "string" || !personIds.has(body.owner)) return { error: "The owner must be a person in this office." };
  if (body.owner !== existing.owner && person.access !== "admin") {
    return { error: "Only an office admin can hand a process to a new owner.", status: 403 };
  }

  if (!Array.isArray(body.steps) || body.steps.length === 0) return { error: "A process needs at least one step." };
  if (body.steps.length > MAX_STEPS) return { error: `A process can have at most ${MAX_STEPS} steps.` };

  const steps: ProcessStep[] = [];
  const ids = new Set<string>();
  for (const [index, raw] of body.steps.entries()) {
    const number = `Step ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: `${number} is not a step.` };
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || !STEP_ID.test(item.id)) {
      return { error: `${number} needs an id made of lowercase letters, digits and dashes.` };
    }
    if (ids.has(item.id)) return { error: `Two steps share the id "${item.id}".` };
    ids.add(item.id);

    if (typeof item.title !== "string" || !item.title.trim()) return { error: "Every step needs a title." };
    const title = line(item.title, `The title of ${number.toLowerCase()}`, true);
    if ("error" in title) return title;
    const called = `"${title.text}"`;
    if (!STEP_KINDS.includes(item.kind as ProcessStep["kind"])) return { error: `${called} must be a start, task, decision or end.` };
    if (typeof item.actor !== "string" || !item.actor) return { error: `${called} needs someone to do it.` };
    if (!personIds.has(item.actor)) return { error: `${called} is given to someone who is not in this office.` };
    const description = paragraph(item.description ?? "", `The description of ${called}`);
    if ("error" in description) return description;
    const stepExample = paragraph(item.example ?? "", `The example of ${called}`);
    if ("error" in stepExample) return stepExample;
    if (!Array.isArray(item.next) || item.next.some((id) => typeof id !== "string")) return { error: `${called} has links that are not step ids.` };

    const step: ProcessStep = {
      id: item.id,
      title: title.text,
      kind: item.kind as ProcessStep["kind"],
      actor: item.actor,
      description: description.text,
      example: stepExample.text,
      next: Array.from(new Set(item.next as string[])),
    };
    if (item.artifact !== undefined && item.artifact !== null && item.artifact !== "") {
      if (typeof item.artifact !== "string" || !documentIds.has(item.artifact)) {
        return { error: `${called} links to a document that is not in the filing cabinet.` };
      }
      // Keep the contract's field order: artifact sits before next.
      const { next, ...rest } = step;
      steps.push({ ...rest, artifact: item.artifact, next });
    } else {
      steps.push(step);
    }
  }

  const starts = steps.filter((step) => step.kind === "start").length;
  if (starts === 0) return { error: "Mark one step as the start." };
  if (starts > 1) return { error: "Only one step can be the start." };
  for (const step of steps) {
    if (step.kind === "end" && step.next.length > 0) return { error: `"${step.title}" is an end, so it cannot lead to another step.` };
    for (const next of step.next) {
      if (next === step.id) return { error: `"${step.title}" cannot lead to itself.` };
      if (!ids.has(next)) return { error: `"${step.title}" leads to a step that does not exist.` };
    }
  }

  return {
    process: { id: existing.id, name: name.text, owner: body.owner, summary: summary.text, trigger: trigger.text, example: example.text, steps },
  };
}
