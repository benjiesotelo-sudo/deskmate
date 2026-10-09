import { findStart } from "./playback.ts";
import type { OfficeProcess, ProcessStep, StepKind } from "./types.ts";

// Automatic left-to-right layout for a process flow.
// Columns come from the longest path from the start (loops back are ignored for ranking),
// and rows stack branches under the main line. No dependencies, deterministic, fast.

export const COLUMN_PITCH = 164;
export const ROW_PITCH = 176;
export const PAD_X = 40;
export const PAD_TOP = 62; // room for a decision caption above the first row
export const PAD_BOTTOM = 62;
export const TASK_W = 132;
export const TASK_H = 84;
export const CIRCLE_R = 26;
export const DIAMOND_R = 38;

export type FlowNode = {
  step: ProcessStep;
  column: number;
  row: number;
  x: number; // centre
  y: number; // centre
  halfW: number;
  halfH: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  path: string;
  back: boolean;
  // arrow head: tip position and the direction the arrow travels as it arrives
  tip: { x: number; y: number; direction: "right" | "up" | "down" };
};

export type FlowLayout = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
  unreachable: string[];
};

function half(kind: StepKind): { halfW: number; halfH: number } {
  if (kind === "task") return { halfW: TASK_W / 2, halfH: TASK_H / 2 };
  if (kind === "decision") return { halfW: DIAMOND_R, halfH: DIAMOND_R };
  return { halfW: CIRCLE_R, halfH: CIRCLE_R };
}

export function layoutProcess(process: OfficeProcess): FlowLayout {
  const steps = process.steps;
  const byId = new Map(steps.map((step) => [step.id, step]));
  const start = findStart(process);
  const order = new Map(steps.map((step, index) => [step.id, index]));
  const links = (step: ProcessStep) => step.next.filter((id) => byId.has(id) && id !== step.id);

  // 1. Find loop-back links with a depth-first walk from the start.
  const backLinks = new Set<string>();
  const state = new Map<string, "open" | "done">();
  const walk = (id: string) => {
    state.set(id, "open");
    for (const nextId of links(byId.get(id) as ProcessStep)) {
      const seen = state.get(nextId);
      if (seen === "open") backLinks.add(`${id}>${nextId}`);
      else if (!seen) walk(nextId);
    }
    state.set(id, "done");
  };
  if (start) walk(start.id);
  const reachable = new Set(state.keys());
  // Steps nobody links to yet (a half-edited process) still get drawn, after the rest.
  const unreachable = steps.filter((step) => !reachable.has(step.id)).map((step) => step.id);
  for (const id of unreachable) if (!state.has(id)) walk(id);

  const forward = (step: ProcessStep) => links(step).filter((id) => !backLinks.has(`${step.id}>${id}`));

  // 2. Column = longest forward path from a root.
  const column = new Map<string, number>();
  const parents = new Map<string, string[]>();
  for (const step of steps) for (const id of forward(step)) parents.set(id, [...(parents.get(id) ?? []), step.id]);
  const columnOf = (id: string, trail: Set<string> = new Set()): number => {
    const known = column.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return 0;
    trail.add(id);
    const ups = parents.get(id) ?? [];
    const value = ups.length === 0 ? 0 : Math.max(...ups.map((up) => columnOf(up, trail) + 1));
    column.set(id, value);
    return value;
  };
  for (const step of steps) columnOf(step.id);
  const mainColumns = Math.max(0, ...steps.filter((s) => reachable.has(s.id)).map((s) => column.get(s.id) ?? 0));

  // 3. How much flow is left after each step: the longest remaining path keeps the main row.
  const remaining = new Map<string, number>();
  const remainingOf = (id: string): number => {
    const known = remaining.get(id);
    if (known !== undefined) return known;
    remaining.set(id, 0);
    const value = Math.max(0, ...forward(byId.get(id) as ProcessStep).map((nextId) => remainingOf(nextId) + 1));
    remaining.set(id, value);
    return value;
  };

  const ends = new Map<string, boolean>();
  const finishes = (id: string): boolean => {
    const known = ends.get(id);
    if (known !== undefined) return known;
    ends.set(id, false);
    const current = byId.get(id) as ProcessStep;
    const value = current.kind === "end" || forward(current).some((nextId) => finishes(nextId));
    ends.set(id, value);
    return value;
  };

  // 4. Rows: a step inherits its parent's row when free, branches stack below.
  const row = new Map<string, number>();
  const taken = new Map<number, Set<number>>();
  const place = (id: string, wanted: number) => {
    if (row.has(id)) return;
    const col = column.get(id) ?? 0;
    const used = taken.get(col) ?? new Set<number>();
    let r = wanted;
    while (used.has(r)) r += 1;
    used.add(r);
    taken.set(col, used);
    row.set(id, r);
    // The child furthest along is where detours rejoin, so it keeps this row. After that, a branch
    // that goes on to an end beats one that only loops back, and then the longest tail wins.
    const children = [...forward(byId.get(id) as ProcessStep)].sort(
      (a, b) =>
        (column.get(b) ?? 0) - (column.get(a) ?? 0) ||
        Number(finishes(b)) - Number(finishes(a)) ||
        remainingOf(b) - remainingOf(a) ||
        (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );
    children.forEach((child, index) => place(child, r + index));
  };
  if (start) place(start.id, 0);
  let spareRow = Math.max(0, ...row.values()) + (unreachable.length > 0 ? 1 : 0);
  for (const id of unreachable) {
    if (!row.has(id)) {
      // park loose steps on their own row, in columns after the main flow would not fit
      column.set(id, Math.min(column.get(id) ?? 0, mainColumns));
      place(id, spareRow);
      spareRow = Math.max(spareRow, row.get(id) ?? spareRow);
    }
  }

  const rows = Math.max(0, ...row.values()) + 1;
  const columns = Math.max(0, ...column.values()) + 1;
  const xOf = (col: number) => PAD_X + TASK_W / 2 + col * COLUMN_PITCH;
  const yOf = (r: number) => PAD_TOP + TASK_H / 2 + r * ROW_PITCH;

  const nodes: FlowNode[] = steps.map((step) => {
    const col = column.get(step.id) ?? 0;
    const r = row.get(step.id) ?? 0;
    return { step, column: col, row: r, x: xOf(col), y: yOf(r), ...half(step.kind) };
  });
  const nodeOf = new Map(nodes.map((node) => [node.step.id, node]));

  const occupied = new Set(nodes.map((node) => `${node.column}:${node.row}`));
  const blocked = (from: FlowNode, to: FlowNode) => {
    for (let col = from.column + 1; col < to.column; col += 1) if (occupied.has(`${col}:${from.row}`)) return true;
    return false;
  };

  const edges: FlowEdge[] = [];
  for (const from of nodes) {
    for (const toId of links(from.step)) {
      const to = nodeOf.get(toId) as FlowNode;
      const id = `${from.step.id}>${toId}`;
      if (backLinks.has(id) || to.column <= from.column) edges.push(backEdge(id, from, to));
      else if (from.row === to.row && blocked(from, to)) edges.push(underEdge(id, from, to, false));
      else edges.push(forwardEdge(id, from, to));
    }
  }

  return {
    nodes,
    edges,
    width: PAD_X * 2 + TASK_W + (columns - 1) * COLUMN_PITCH,
    height: PAD_TOP + TASK_H + (rows - 1) * ROW_PITCH + PAD_BOTTOM,
    unreachable,
  };
}

const ARROW = 7; // the path stops this far short of the shape so the arrow head sits on its edge

function forwardEdge(id: string, from: FlowNode, to: FlowNode): FlowEdge {
  const endX = to.x - to.halfW;
  const tip = { x: endX, y: to.y, direction: "right" as const };
  if (from.row === to.row) {
    return { id, from: from.step.id, to: to.step.id, back: false, tip, path: `M ${from.x + from.halfW} ${from.y} H ${endX - ARROW}` };
  }
  if (from.step.kind === "decision" && to.row > from.row) {
    // BPMN habit: the alternative leaves a gateway from its lower corner.
    const startY = from.y + from.halfH;
    const radius = 14;
    return {
      id,
      from: from.step.id,
      to: to.step.id,
      back: false,
      tip,
      path: `M ${from.x} ${startY} V ${to.y - radius} Q ${from.x} ${to.y} ${from.x + radius} ${to.y} H ${endX - ARROW}`,
    };
  }
  const startX = from.x + from.halfW;
  const mid = (startX + endX) / 2;
  return {
    id,
    from: from.step.id,
    to: to.step.id,
    back: false,
    tip,
    path: `M ${startX} ${from.y} C ${mid} ${from.y} ${mid} ${to.y} ${endX - ARROW} ${to.y}`,
  };
}

// Where a vertical line at `dx` from the centre meets the lower outline of a shape.
function lowerEdge(node: FlowNode, dx: number): number {
  if (node.step.kind === "task") return node.y + node.halfH;
  if (node.step.kind === "decision") return node.y + node.halfH - Math.abs(dx);
  return node.y + Math.sqrt(Math.max(0, node.halfH * node.halfH - dx * dx));
}

// A link that dips under its row and rises into the target from below. Used for loops back
// along the same row and for forward links that would otherwise run through another step.
function underEdge(id: string, from: FlowNode, to: FlowNode, back: boolean): FlowEdge {
  const radius = 12;
  const laneY = Math.max(from.y, to.y) + TASK_H / 2 + 46;
  const endY = lowerEdge(to, 0);
  const turn = to.x < from.x ? -radius : radius;
  return {
    id,
    from: from.step.id,
    to: to.step.id,
    back,
    tip: { x: to.x, y: endY, direction: "up" },
    path: `M ${from.x} ${lowerEdge(from, 0)} V ${laneY - radius} Q ${from.x} ${laneY} ${from.x + turn} ${laneY} H ${to.x - turn} Q ${to.x} ${laneY} ${to.x} ${laneY - radius} V ${endY + ARROW}`,
  };
}

function backEdge(id: string, from: FlowNode, to: FlowNode): FlowEdge {
  if (from.row <= to.row) return underEdge(id, from, to, true);
  // From a branch below: leave from the top, run along the lane above this row, and rise into
  // the target from below. A gateway is entered off-centre so its own downward branch stays clear.
  const radius = 12;
  const dx = to.step.kind === "decision" ? 18 : 0;
  const laneY = from.y - TASK_H / 2 - 24;
  const endX = to.x + dx;
  const endY = lowerEdge(to, dx);
  return {
    id,
    from: from.step.id,
    to: to.step.id,
    back: true,
    tip: { x: endX, y: endY, direction: "up" },
    path: `M ${from.x} ${from.y - from.halfH} V ${laneY + radius} Q ${from.x} ${laneY} ${from.x - radius} ${laneY} H ${endX + radius} Q ${endX} ${laneY} ${endX} ${laneY - radius} V ${endY + ARROW}`,
  };
}

// Steps in reading order: left to right as drawn, a branch after the main line of its column.
export function readingOrder(process: OfficeProcess): ProcessStep[] {
  return [...layoutProcess(process).nodes].sort((a, b) => a.column - b.column || a.row - b.row).map((node) => node.step);
}
