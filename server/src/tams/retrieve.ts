import { db } from "../db.ts";
import { embed } from "./ollama.ts";

const QUERY_PREFIX = "search_query: ";

export type Passage = {
  sourceType: "document" | "process";
  sourceId: string;
  title: string;
  ord: number;
  text: string;
  score: number;
};

export type Retrieval = {
  passages: Passage[];
  // The process that best answers the question, when one clearly does.
  processId: string | null;
  method: "embeddings" | "keywords";
};

const STOP = new Set(
  "a an and are as at be but by do does for from how i if in into is it me my of on or our so than that the their them then there these they this to up was we what when where which who why will with you your can could should would have has had about please tell know need want get".split(
    " ",
  ),
);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

// A very small stemmer, so "release", "releases" and "releasing" all meet.
function stem(word: string): string {
  if (word.length <= 4) return word;
  return word
    .replace(/(ing|ed|es|s)$/, "")
    .replace(/e$/, "")
    .replace(/(.)\1$/, "$1");
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Share of the question's meaningful words that appear in a passage.
export function keywordScore(queryTokens: string[], text: string): number {
  if (!queryTokens.length) return 0;
  const have = new Set(tokens(text));
  let hit = 0;
  for (const t of queryTokens) if (have.has(t)) hit += 1;
  return hit / queryTokens.length;
}

type Row = { source_type: "document" | "process"; source_id: string; title: string; ord: number; text: string; embedding: string | null };

// Thresholds measured on the sample office with nomic-embed-text: unrelated
// questions top out near 0.57 cosine, real office questions start near 0.62.
const MIN_TOP_COSINE = 0.59;
const MIN_PASSAGE_COSINE = 0.55;
const MIN_KEYWORD_SCORE = 0.5;
const KEYWORD_WEIGHT = 0.2;

export async function retrieve(question: string, limit = 5): Promise<Retrieval> {
  const rows = db
    .prepare(
      `SELECT c.source_type, c.source_id, c.title, c.ord, c.text, c.embedding
       FROM chunks c LEFT JOIN documents d ON c.source_type = 'document' AND d.id = c.source_id
       WHERE c.source_type = 'process' OR d.status != 'superseded'`,
    )
    .all() as Row[];
  const queryTokens = tokens(question);

  let queryVector: number[] | null = null;
  if (rows.some((r) => r.embedding)) {
    try {
      [queryVector] = await embed([QUERY_PREFIX + question]);
    } catch {
      queryVector = null;
    }
  }

  const method = queryVector ? "embeddings" : "keywords";
  const scored: (Passage & { cos: number })[] = rows.map((r) => {
    const kw = keywordScore(queryTokens, `${r.title} ${r.text}`);
    const cos = queryVector && r.embedding ? cosine(queryVector, JSON.parse(r.embedding) as number[]) : 0;
    const score = queryVector && r.embedding ? cos + KEYWORD_WEIGHT * kw : kw;
    return { sourceType: r.source_type, sourceId: r.source_id, title: r.title, ord: r.ord, text: r.text, score, cos };
  });
  scored.sort((a, b) => b.score - a.score);

  // First decide whether the office has anything on this at all.
  const relevant =
    method === "embeddings"
      ? scored.some((p) => p.cos >= MIN_TOP_COSINE)
        ? scored.filter((p) => p.cos >= MIN_PASSAGE_COSINE)
        : []
      : scored.filter((p) => p.score >= MIN_KEYWORD_SCORE);
  if (!relevant.length) return { passages: [], processId: null, method };

  // A process answers the question when its best passage is at, or right next to, the top.
  const best = relevant[0];
  const bestProcess = relevant.find((p) => p.sourceType === "process");
  const processId = bestProcess && bestProcess.score >= best.score * 0.93 ? bestProcess.sourceId : null;

  const picked: Passage[] = [];
  if (processId) {
    // Give the model the whole process in order, so no step is skipped.
    picked.push(...scored.filter((p) => p.sourceType === "process" && p.sourceId === processId).sort((a, b) => a.ord - b.ord));
  }
  const perSource = new Map<string, number>();
  for (const p of relevant) {
    if (picked.length >= limit + (processId ? 2 : 0)) break;
    if (picked.includes(p)) continue;
    if (p.sourceType === "process" && processId && p.sourceId !== processId) continue;
    const key = `${p.sourceType}:${p.sourceId}`;
    const used = perSource.get(key) ?? 0;
    if (used >= 2) continue;
    perSource.set(key, used + 1);
    picked.push(p);
  }
  return { passages: picked, processId, method };
}
