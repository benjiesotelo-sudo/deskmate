import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { finaliseIds, problemsOf } from "./edit.ts";
import { layoutProcess, readingOrder } from "./layout.ts";
import { buildRun } from "./playback.ts";
import type { OfficeProcess, Person, ProcessStep } from "./types.ts";

const read = <T>(relative: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")) as T;
const processes = read<OfficeProcess[]>("../../../data/sample-office/processes.json");
const people = read<Person[]>("../../../data/sample-office/people.json");

const step = (id: string, kind: ProcessStep["kind"], next: string[]): ProcessStep => ({
  id,
  title: id,
  kind,
  actor: "a",
  description: "",
  example: "",
  next,
});
const make = (steps: ProcessStep[]): OfficeProcess => ({ id: "p", name: "P", owner: "a", summary: "", trigger: "", example: "", steps });

test("sample office: every process is well formed and points at real people", () => {
  assert.ok(processes.length >= 4, "four documented processes");
  const personIds = new Set(people.map((person) => person.id));
  for (const process of processes) {
    assert.ok(personIds.has(process.owner), `${process.id}: owner exists`);
    const ids = new Set(process.steps.map((item) => item.id));
    assert.equal(ids.size, process.steps.length, `${process.id}: step ids are unique`);
    assert.equal(process.steps.filter((item) => item.kind === "start").length, 1, `${process.id}: one start`);
    assert.ok(process.steps.some((item) => item.kind === "end"), `${process.id}: has an end`);
    for (const item of process.steps) {
      assert.ok(personIds.has(item.actor), `${process.id}/${item.id}: actor exists`);
      assert.ok(item.example.trim().length > 0, `${process.id}/${item.id}: has a concrete example`);
      for (const next of item.next) assert.ok(ids.has(next), `${process.id}/${item.id}: next ${next} exists`);
    }
    assert.deepEqual(problemsOf(process).errors, [], `${process.id}: the editor finds no errors`);
  }
});

test("sample office: the copies served to the browser match the source of truth", () => {
  for (const name of ["people.json", "processes.json"]) {
    assert.deepEqual(read(`../../public/sample/${name}`), read(`../../../data/sample-office/${name}`), name);
  }
});

test("sample office: every process plays from its start to an end and draws without overlap", () => {
  for (const process of processes) {
    const run = buildRun(process);
    const byId = new Map(process.steps.map((item) => [item.id, item]));
    assert.equal(byId.get(run[0] as string)?.kind, "start", `${process.id}: starts at the start`);
    assert.equal(byId.get(run.at(-1) as string)?.kind, "end", `${process.id}: finishes at an end`);
    for (let i = 1; i < run.length; i += 1) {
      assert.ok(byId.get(run[i - 1] as string)?.next.includes(run[i] as string), `${process.id}: ${run[i - 1]} leads to ${run[i]}`);
    }
    const layout = layoutProcess(process);
    assert.equal(layout.nodes.length, process.steps.length);
    assert.deepEqual(layout.unreachable, [], `${process.id}: every step is reachable`);
    const cells = new Set(layout.nodes.map((node) => `${node.column}:${node.row}`));
    assert.equal(cells.size, layout.nodes.length, `${process.id}: no two steps share a cell`);
    assert.equal(layout.edges.length, process.steps.reduce((sum, item) => sum + item.next.length, 0));
    for (const node of layout.nodes) {
      assert.ok(node.x - node.halfW >= 0 && node.x + node.halfW <= layout.width, `${process.id}/${node.step.id}: inside the canvas`);
      assert.ok(node.y - node.halfH >= 0 && node.y + node.halfH <= layout.height, `${process.id}/${node.step.id}: inside the canvas`);
    }
  }
});

test("buildRun walks a send-it-back loop once, then carries on", () => {
  const process = make([
    step("start", "start", ["check"]),
    step("check", "decision", ["fix", "done"]),
    step("fix", "task", ["check"]),
    step("done", "end", []),
  ]);
  assert.deepEqual(buildRun(process), ["start", "check", "fix", "check", "done"]);
});

test("buildRun takes the first link when it is the way forward", () => {
  const process = make([
    step("start", "start", ["check"]),
    step("check", "decision", ["done", "fix"]),
    step("fix", "task", ["check"]),
    step("done", "end", []),
  ]);
  assert.deepEqual(buildRun(process), ["start", "check", "done"]);
});

test("buildRun always stops, even when a process has no way out", () => {
  const process = make([step("a", "start", ["b"]), step("b", "task", ["a"])]);
  const run = buildRun(process);
  assert.ok(run.length <= process.steps.length * 2 + 1);
  assert.deepEqual(buildRun(make([])), []);
});

test("layout keeps the main line on one row and drops a detour below it", () => {
  const process = make([
    step("start", "start", ["ask"]),
    step("ask", "decision", ["detour", "join"]),
    step("detour", "task", ["join"]),
    step("join", "task", ["end"]),
    step("end", "end", []),
  ]);
  const layout = layoutProcess(process);
  const at = (id: string) => layout.nodes.find((node) => node.step.id === id);
  assert.deepEqual([at("start")?.row, at("ask")?.row, at("join")?.row, at("end")?.row], [0, 0, 0, 0]);
  assert.equal(at("detour")?.row, 1);
  assert.deepEqual(
    ["start", "ask", "detour", "join", "end"].map((id) => at(id)?.column),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(readingOrder(process).map((item) => item.id), ["start", "ask", "detour", "join", "end"]);
});

test("layout marks a link that returns to an earlier step as a loop back", () => {
  const process = make([
    step("start", "start", ["check"]),
    step("check", "decision", ["fix", "done"]),
    step("fix", "task", ["check"]),
    step("done", "end", []),
  ]);
  const layout = layoutProcess(process);
  assert.equal(layout.edges.find((edge) => edge.id === "fix>check")?.back, true);
  assert.equal(layout.edges.find((edge) => edge.id === "check>done")?.back, false);
  assert.equal(layout.nodes.find((node) => node.step.id === "fix")?.row, 1);
});

test("layout still draws steps that nothing links to yet", () => {
  const layout = layoutProcess(make([step("start", "start", ["end"]), step("end", "end", []), step("loose", "task", [])]));
  assert.deepEqual(layout.unreachable, ["loose"]);
  assert.equal(new Set(layout.nodes.map((node) => `${node.column}:${node.row}`)).size, 3);
});

test("editor: new steps get readable unique ids and links follow the rename", () => {
  const process = make([
    step("start", "start", ["new-step-1"]),
    { ...step("new-step-1", "task", ["new-step-2"]), title: " File it " },
    { ...step("new-step-2", "task", ["file-it"]), title: "File it" },
    step("file-it", "end", []),
  ]);
  const saved = finaliseIds(process);
  assert.deepEqual(saved.steps.map((item) => item.id), ["start", "file-it-2", "file-it-3", "file-it"]);
  assert.deepEqual(saved.steps.map((item) => item.next), [["file-it-2"], ["file-it-3"], ["file-it"], []]);
  assert.equal(saved.steps[1]?.title, "File it");
});

test("editor: blocks a process without a start or with an untitled step", () => {
  assert.ok(problemsOf(make([step("a", "task", [])])).errors.some((text) => text.includes("start")));
  assert.ok(problemsOf(make([{ ...step("a", "start", []), title: " " }])).errors.some((text) => text.includes("title")));
  assert.ok(problemsOf(make([step("a", "start", [])])).warnings.some((text) => text.includes("leads nowhere")));
});
