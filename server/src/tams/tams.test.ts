import assert from "node:assert/strict";
import { test } from "node:test";
import { chunkProcess, chunkText } from "./chunk.ts";

// retrieve.ts opens the database on import, so its pure helpers are loaded against a throwaway one.
process.env.DESKMATE_DB = ":memory:";
const { cosine, keywordScore, tokens } = await import("./retrieve.ts");
const { plainDashes } = await import("./chat.ts");

test("answers are written with plain dashes only", () => {
  assert.equal(plainDashes("France\u2014this"), "France - this");
  assert.equal(plainDashes("weeks 3 \u2013 5"), "weeks 3 - 5");
  assert.equal(plainDashes("FIN201-ch01 - quiz"), "FIN201-ch01 - quiz");
});

test("cosine similarity", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosine([1, 1], [1, 0]) - Math.SQRT1_2) < 1e-9);
  assert.equal(cosine([0, 0], [1, 0]), 0);
});

test("tokens drop filler words and fold plurals", () => {
  assert.deepEqual(tokens("How do I release the quizzes?"), ["releas", "quiz"]);
  assert.deepEqual(tokens("quiz releases"), ["quiz", "releas"]);
  assert.deepEqual(tokens("processes"), tokens("process"));
});

test("keyword score is the share of question words found", () => {
  const q = tokens("release a quiz");
  assert.equal(keywordScore(q, "How to release the chapter quiz"), 1);
  assert.equal(keywordScore(q, "Release notes"), 0.5);
  assert.equal(keywordScore([], "anything"), 0);
});

test("chunks break at headings and stay a readable size", () => {
  const text = ["# Title", "", "Intro paragraph.", "", "## One", "", "a ".repeat(300), "", "## Two", "", "b ".repeat(300)].join("\n");
  const chunks = chunkText(text);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((c) => c.length < 1400));
  assert.ok(chunks[0].startsWith("# Title"));
});

test("a process becomes an overview plus its steps in order", () => {
  const chunks = chunkProcess(
    {
      id: "p",
      name: "Do the thing",
      owner: "a",
      summary: "Summary.",
      trigger: "Trigger.",
      example: "Example.",
      steps: [
        { id: "s1", title: "First", kind: "start", actor: "a", description: "d1", example: "e1", next: ["s2"] },
        { id: "s2", title: "Second", kind: "end", actor: "a", description: "d2", example: "e2", next: [] },
      ],
    },
    [{ id: "a", name: "Ana Cruz" } as never],
  );
  assert.equal(chunks.length, 2);
  assert.match(chunks[0], /Process: Do the thing/);
  assert.match(chunks[0], /1\. First 2\. Second/);
  assert.match(chunks[1], /done by Ana Cruz/);
});
