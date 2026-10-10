// Shapes shared with deskmate-core (GET /api/people, GET /api/processes). Do not change them here.

export type Person = {
  id: string;
  name: string;
  role: string;
  email: string;
  location: "office" | "home";
  desk: { x: number; y: number };
  avatar: { skin: string; hair: string; outfit: string; accessory: string };
  owns: { documents: string[]; processes: string[] };
};

export type StepKind = "start" | "task" | "decision" | "end";

export type ProcessStep = {
  id: string;
  title: string;
  kind: StepKind;
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

export const STEP_KINDS: StepKind[] = ["start", "task", "decision", "end"];

export const KIND_LABEL: Record<StepKind, string> = {
  start: "Start",
  task: "Task",
  decision: "Decision",
  end: "End",
};
