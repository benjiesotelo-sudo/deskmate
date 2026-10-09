import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { computeReadiness } from "./readiness.ts";
import type { Course, DocRecord, OfficeProcess, Person } from "./types.ts";

const sample = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "sample-office");
const read = <T>(name: string) => JSON.parse(fs.readFileSync(path.join(sample, name), "utf8")) as T;
const courses = read<Course[]>("courses.json");
const docs = read<DocRecord[]>("documents.json");
const people = read<Person[]>("people.json");
const processes = read<OfficeProcess[]>("processes.json");

const course: Course = { id: "X1", title: "Test", term: "T", coordinator: "a", chapters: [{ number: 1, title: "One" }] };
const doc = (over: Partial<DocRecord>): DocRecord => ({
  id: "x",
  title: "x",
  kind: "deck",
  course: "X1",
  term: "T",
  chapter: 1,
  owner: "a",
  version: 1,
  status: "current",
  path: "x.md",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

test("an empty course is all gaps", () => {
  const r = computeReadiness([course], []);
  assert.equal(r.required, 4);
  assert.equal(r.present, 0);
  assert.equal(r.score, 0);
  assert.deepEqual(r.courses[0].gaps.map((g) => g.state), ["missing", "missing", "missing", "missing"]);
});

test("only current documents count", () => {
  const r = computeReadiness(
    [course],
    [
      doc({ id: "s", kind: "syllabus", chapter: null }),
      doc({ id: "d", kind: "deck", status: "draft" }),
      doc({ id: "m", kind: "materials", status: "superseded" }),
      doc({ id: "q1", kind: "quiz", status: "superseded" }),
      doc({ id: "q2", kind: "quiz", version: 2 }),
    ],
  );
  assert.equal(r.present, 2);
  assert.equal(r.score, 50);
  const states = Object.fromEntries(r.courses[0].slots.map((s) => [s.kind, s.state]));
  assert.deepEqual(states, { syllabus: "current", deck: "draft", materials: "superseded", quiz: "current" });
  assert.equal(r.courses[0].slots.find((s) => s.kind === "quiz")!.docId, "q2");
});

test("two current documents in one slot are flagged", () => {
  const r = computeReadiness([course], [doc({ id: "a" }), doc({ id: "b", version: 2 })]);
  assert.deepEqual(r.courses[0].slots.find((s) => s.kind === "deck")!.duplicates.sort(), ["a", "b"]);
});

test("the sample office scores what the README says", () => {
  const r = computeReadiness(courses, docs);
  assert.equal(r.required, 36);
  assert.equal(r.present, 28);
  assert.equal(r.score, 78);
  assert.deepEqual(
    r.courses.map((c) => [c.id, c.present, c.required]),
    [
      ["BUS101", 12, 13],
      ["FIN201", 10, 13],
      ["MKT150", 6, 10],
    ],
  );
});

test("the sample office has no dangling references", () => {
  const personIds = new Set(people.map((p) => p.id));
  const docIds = new Set(docs.map((d) => d.id));
  for (const d of docs) {
    assert.ok(personIds.has(d.owner), `${d.id} owner`);
    assert.ok(fs.existsSync(path.join(sample, d.path)), `${d.id} file`);
  }
  for (const p of processes) {
    assert.ok(personIds.has(p.owner), `${p.id} owner`);
    const stepIds = new Set(p.steps.map((s) => s.id));
    for (const s of p.steps) {
      assert.ok(personIds.has(s.actor), `${p.id}/${s.id} actor`);
      if (s.artifact) assert.ok(docIds.has(s.artifact), `${p.id}/${s.id} artifact`);
      for (const n of s.next) assert.ok(stepIds.has(n), `${p.id}/${s.id} next`);
    }
  }
  for (const p of people) {
    assert.deepEqual([...p.owns.documents].sort(), docs.filter((d) => d.owner === p.id).map((d) => d.id).sort());
  }
});

test("sample copy uses plain dashes only", () => {
  for (const d of docs) {
    if (!d.path.endsWith(".md")) continue;
    assert.ok(!/[\u2013\u2014]/.test(fs.readFileSync(path.join(sample, d.path), "utf8")), d.path);
  }
  assert.ok(!/[\u2013\u2014]/.test(JSON.stringify(processes)));
});
