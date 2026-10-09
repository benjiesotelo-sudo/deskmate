import { db, setMeta } from "../db.ts";
import { getDocument, listDocuments } from "../documents.ts";
import { peopleFile, processes } from "../office.ts";
import { chunkProcess, chunkText } from "./chunk.ts";
import { embed, ollamaState } from "./ollama.ts";

// nomic-embed-text is trained with task prefixes on both sides.
const DOC_PREFIX = "search_document: ";
const BATCH = 16;

let building: Promise<IndexSummary> | null = null;

export type IndexSummary = { chunks: number; embedded: number; documents: number; processes: number };

export const isBuilding = () => building !== null;

function writeChunks(sourceType: "document" | "process", sourceId: string, title: string, chunks: string[]) {
  db.prepare("DELETE FROM chunks WHERE source_type = ? AND source_id = ?").run(sourceType, sourceId);
  const insert = db.prepare("INSERT INTO chunks (source_type, source_id, title, ord, text) VALUES (?, ?, ?, ?, ?)");
  chunks.forEach((text, ord) => insert.run(sourceType, sourceId, title, ord, text));
}

async function embedPending(): Promise<number> {
  const state = await ollamaState();
  if (!state.embedReady) return 0;
  const pending = db.prepare("SELECT id, title, text FROM chunks WHERE embedding IS NULL ORDER BY id").all() as {
    id: number;
    title: string;
    text: string;
  }[];
  const update = db.prepare("UPDATE chunks SET embedding = ? WHERE id = ?");
  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const vectors = await embed(batch.map((c) => `${DOC_PREFIX}${c.title}\n${c.text}`));
    batch.forEach((c, j) => update.run(JSON.stringify(vectors[j]), c.id));
    done += batch.length;
  }
  return done;
}

export function indexSummary(): IndexSummary {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS chunks,
              COALESCE(SUM(embedding IS NOT NULL), 0) AS embedded,
              COUNT(DISTINCT CASE WHEN source_type = 'document' THEN source_id END) AS documents,
              COUNT(DISTINCT CASE WHEN source_type = 'process' THEN source_id END) AS processes
       FROM chunks`,
    )
    .get() as IndexSummary;
  return { chunks: Number(row.chunks), embedded: Number(row.embedded), documents: Number(row.documents), processes: Number(row.processes) };
}

// Rebuild the whole index: every document and every process.
// Passages are always written, so keyword search works even with Ollama off.
// Embeddings are added when the embedding model is available.
export function rebuildIndex(): Promise<IndexSummary> {
  if (building) return building;
  building = (async () => {
    try {
      db.exec("DELETE FROM chunks");
      for (const record of listDocuments()) {
        const doc = getDocument(record.id);
        if (doc?.body.trim()) writeChunks("document", doc.id, doc.title, chunkText(doc.body));
      }
      const people = peopleFile();
      for (const process of processes()) writeChunks("process", process.id, process.name, chunkProcess(process, people));
      await embedPending();
      setMeta("index_built_at", new Date().toISOString());
      return indexSummary();
    } finally {
      building = null;
    }
  })();
  return building;
}

// Re-index one document after it is filed or its text changes.
export async function indexDocument(id: string): Promise<void> {
  const doc = getDocument(id);
  if (!doc) return;
  writeChunks("document", doc.id, doc.title, doc.body.trim() ? chunkText(doc.body) : []);
  try {
    await embedPending();
  } catch {
    // Left without embeddings. Keyword search still finds it, and the next rebuild embeds it.
  }
}

// Re-index one process after its steps are edited, so Tams answers from the new version.
export async function indexProcess(id: string): Promise<void> {
  const process = processes().find((p) => p.id === id);
  if (!process) return;
  writeChunks("process", process.id, process.name, chunkProcess(process, peopleFile()));
  try {
    await embedPending();
  } catch {
    // Left without embeddings. Keyword search still finds it, and the next rebuild embeds it.
  }
}

// Fill in embeddings that are missing, for example when Ollama was off during seeding.
export async function completeEmbeddings(): Promise<number> {
  if (building) return 0;
  try {
    return await embedPending();
  } catch {
    return 0;
  }
}

export function removeDocumentFromIndex(id: string) {
  db.prepare("DELETE FROM chunks WHERE source_type = 'document' AND source_id = ?").run(id);
}
