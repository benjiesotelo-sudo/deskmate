import type { OfficeProcess, Person } from "../types.ts";

const TARGET = 800;

// Split a document into passages of roughly TARGET characters, breaking at
// headings and paragraphs so each passage still makes sense on its own.
export function chunkText(text: string): string[] {
  const blocks = text
    .replace(/\r/g, "")
    .split(/\n{2,}|\n(?=#{1,6} )/)
    .map((b) => b.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const block of blocks) {
    const isHeading = /^#{1,6} /.test(block);
    if (isHeading && current.length > TARGET * 0.5) push();
    if (current.length + block.length + 2 > TARGET && current) push();
    if (block.length > TARGET * 1.5) {
      // A very long paragraph (common in PDFs): cut on sentence ends.
      for (const sentence of block.split(/(?<=[.!?])\s+/)) {
        if (current.length + sentence.length + 1 > TARGET && current) push();
        current += (current ? " " : "") + sentence;
      }
    } else {
      current += (current ? "\n\n" : "") + block;
    }
  }
  push();
  return chunks;
}

// A process becomes an overview passage plus passages of a few steps each.
export function chunkProcess(process: OfficeProcess, people: Person[]): string[] {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const overview = [
    `Process: ${process.name}`,
    `Owner: ${name(process.owner)}`,
    `What it is for: ${process.summary}`,
    `When it starts: ${process.trigger}`,
    `Real example: ${process.example}`,
    `Steps in order: ${process.steps.map((s, i) => `${i + 1}. ${s.title}`).join(" ")}`,
  ].join("\n");
  const chunks = [overview];
  for (let i = 0; i < process.steps.length; i += 3) {
    const part = process.steps.slice(i, i + 3).map((s, j) => {
      const label = s.kind === "decision" ? "Decision" : s.kind === "start" ? "Start" : s.kind === "end" ? "End" : "Step";
      return `${label} ${i + j + 1}: ${s.title} (done by ${name(s.actor)})\n${s.description}\nExample: ${s.example}`;
    });
    chunks.push(`Process: ${process.name}\n${part.join("\n\n")}`);
  }
  return chunks;
}
