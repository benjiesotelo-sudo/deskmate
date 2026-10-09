import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { canEditProcess, checkProcess } from "./processes.ts";
import type { DocRecord, OfficeProcess, Person } from "./types.ts";

const sample = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "sample-office");
const read = <T>(name: string) => JSON.parse(fs.readFileSync(path.join(sample, name), "utf8")) as T;
const people = read<Person[]>("people.json");
const processes = read<OfficeProcess[]>("processes.json");
const personIds = new Set(people.map((p) => p.id));
const documentIds = new Set(read<DocRecord[]>("documents.json").map((d) => d.id));

const quiz = processes.find((p) => p.id === "release-quiz")!;
const admin = { id: "marisol", access: "admin" } as const;
const owner = { id: quiz.owner, access: "staff" } as const;
const other = { id: "bea", access: "staff" } as const;
const check = (input: unknown, person: Pick<Person, "id" | "access"> = admin) => checkProcess(input, { existing: quiz, person, personIds, documentIds });
const copy = () => structuredClone(quiz);
const errorOf = (result: ReturnType<typeof check>) => ("error" in result ? result.error : "");

test("every sample process passes the save check unchanged", () => {
  for (const process of processes) {
    const result = checkProcess(structuredClone(process), { existing: process, person: admin, personIds, documentIds });
    assert.ok("process" in result, `${process.id}: ${errorOf(result)}`);
    assert.deepEqual(result.process, process);
  }
});

test("an admin and the process owner can save, other staff cannot", () => {
  assert.ok(canEditProcess(admin, quiz));
  assert.ok(canEditProcess(owner, quiz));
  assert.ok(!canEditProcess(other, quiz));
  assert.ok("process" in check(copy(), owner));
  const refused = check(copy(), other);
  assert.ok("error" in refused);
  assert.equal(refused.status, 403);
});

test("only an admin can hand a process to a new owner", () => {
  const refused = check({ ...copy(), owner: "bea" }, owner);
  assert.ok("error" in refused);
  assert.equal(refused.status, 403);
  const allowed = check({ ...copy(), owner: "bea" }, admin);
  assert.ok("process" in allowed);
  assert.equal(allowed.process.owner, "bea");
});

test("a saved process keeps only the contract's fields and trims its text", () => {
  const edited = copy() as OfficeProcess & { extra?: string };
  edited.extra = "dropped";
  edited.steps[1] = { ...edited.steps[1], title: "  Open the quiz  ", artifact: "" };
  const result = check(edited);
  assert.ok("process" in result, errorOf(result));
  assert.equal("extra" in result.process, false);
  assert.equal(result.process.steps[1].title, "Open the quiz");
  assert.equal("artifact" in result.process.steps[1], false);
});

test("a process must keep its id, one start and a title on every step", () => {
  assert.match(errorOf(check({ ...copy(), id: "something-else" })), /id cannot be changed/);
  assert.match(errorOf(check({ ...copy(), steps: [] })), /at least one step/);

  const noStart = copy();
  noStart.steps[0].kind = "task";
  assert.match(errorOf(check(noStart)), /Mark one step as the start/);

  const twoStarts = copy();
  twoStarts.steps[1].kind = "start";
  assert.match(errorOf(check(twoStarts)), /Only one step can be the start/);

  const untitled = copy();
  untitled.steps[2].title = "   ";
  assert.match(errorOf(check(untitled)), /Every step needs a title/);
});

test("a process cannot point at people, documents or steps that do not exist", () => {
  const stranger = copy();
  stranger.steps[1].actor = "nobody";
  assert.match(errorOf(check(stranger)), /not in this office/);

  const lostDocument = copy();
  lostDocument.steps[1].artifact = "no-such-document-v1";
  assert.match(errorOf(check(lostDocument)), /not in the filing cabinet/);

  const lostStep = copy();
  lostStep.steps[1].next = ["nowhere"];
  assert.match(errorOf(check(lostStep)), /does not exist/);

  const twins = copy();
  twins.steps[2].id = twins.steps[1].id;
  assert.match(errorOf(check(twins)), /share the id/);

  const endLeads = copy();
  endLeads.steps.at(-1)!.next = [endLeads.steps[0].id];
  assert.match(errorOf(check(endLeads)), /cannot lead to another step/);
});
