// Developer tool: show what Tams retrieves for a question. Usage: npx tsx server/src/cli/probe.ts "question" [--ask]
import { db } from "../db.ts";
import { answer } from "../tams/chat.ts";
import { embed } from "../tams/ollama.ts";
import { cosine, keywordScore, retrieve, tokens } from "../tams/retrieve.ts";

const questions = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ask = process.argv.includes("--ask");

for (const q of questions) {
  const r = await retrieve(q);
  const [v] = await embed(["search_query: " + q]);
  const rows = db.prepare("SELECT source_id, ord, title, text, embedding FROM chunks").all() as any[];
  const top = rows
    .map((x) => ({ id: `${x.source_id}#${x.ord}`, cos: cosine(v, JSON.parse(x.embedding)), kw: keywordScore(tokens(q), `${x.title} ${x.text}`) }))
    .sort((a, b) => b.cos - a.cos)
    .slice(0, 4);
  console.log(`\nQ: ${q}\n  processId=${r.processId} method=${r.method} picked=${r.passages.map((p) => `${p.sourceId}#${p.ord}(${p.score.toFixed(2)})`).join(", ")}`);
  console.log("  top cosine: " + top.map((t) => `${t.id} cos=${t.cos.toFixed(3)} kw=${t.kw.toFixed(2)}`).join(" | "));
  if (ask) {
    const started = Date.now();
    let first = 0;
    const frame = await answer([{ role: "user", content: q }], "local", (text) => {
      if (!first) first = Date.now() - started;
      process.stdout.write(text);
    });
    console.log(`\n  [first word ${first}ms, total ${Date.now() - started}ms] ${JSON.stringify(frame)}`);
  }
}
