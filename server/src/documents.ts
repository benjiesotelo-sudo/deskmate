import { db } from "./db.ts";
import type { DocRecord, Kind, Status } from "./types.ts";

type Row = {
  id: string;
  title: string;
  kind: Kind;
  course: string;
  term: string;
  chapter: number | null;
  owner: string;
  version: number;
  status: Status;
  path: string;
  updated_at: string;
};

const COLUMNS = "id, title, kind, course, term, chapter, owner, version, status, path, updated_at";

function toRecord(r: Row): DocRecord {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    course: r.course,
    term: r.term,
    chapter: r.chapter,
    owner: r.owner,
    version: r.version,
    status: r.status,
    path: r.path,
    updatedAt: r.updated_at,
  };
}

export type DocFilter = { course?: string; chapter?: number | null; kind?: string; owner?: string; status?: string };

export function listDocuments(filter: DocFilter = {}): DocRecord[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.course) {
    where.push("course = ?");
    args.push(filter.course);
  }
  if (filter.chapter === null) where.push("chapter IS NULL");
  else if (filter.chapter !== undefined) {
    where.push("chapter = ?");
    args.push(filter.chapter);
  }
  if (filter.kind) {
    where.push("kind = ?");
    args.push(filter.kind);
  }
  if (filter.owner) {
    where.push("owner = ?");
    args.push(filter.owner);
  }
  if (filter.status) {
    where.push("status = ?");
    args.push(filter.status);
  }
  const sql = `SELECT ${COLUMNS} FROM documents ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY course, chapter IS NOT NULL, chapter, kind, version DESC`;
  return (db.prepare(sql).all(...args) as Row[]).map(toRecord);
}

export function getDocument(id: string): (DocRecord & { body: string }) | undefined {
  const row = db.prepare(`SELECT ${COLUMNS}, body FROM documents WHERE id = ?`).get(id) as (Row & { body: string }) | undefined;
  return row ? { ...toRecord(row), body: row.body } : undefined;
}

export function insertDocument(doc: DocRecord, body: string) {
  db.prepare(
    `INSERT INTO documents (${COLUMNS}, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, kind = excluded.kind, course = excluded.course, term = excluded.term,
       chapter = excluded.chapter, owner = excluded.owner, version = excluded.version, status = excluded.status,
       path = excluded.path, updated_at = excluded.updated_at, body = excluded.body`,
  ).run(doc.id, doc.title, doc.kind, doc.course, doc.term, doc.chapter, doc.owner, doc.version, doc.status, doc.path, doc.updatedAt, body);
}

export type DocPatch = Partial<Pick<DocRecord, "title" | "kind" | "course" | "term" | "chapter" | "owner" | "version" | "status">>;

export function updateDocument(id: string, patch: DocPatch): DocRecord | undefined {
  const current = getDocument(id);
  if (!current) return undefined;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  db.prepare(
    "UPDATE documents SET title = ?, kind = ?, course = ?, term = ?, chapter = ?, owner = ?, version = ?, status = ?, updated_at = ? WHERE id = ?",
  ).run(next.title, next.kind, next.course, next.term, next.chapter, next.owner, next.version, next.status, next.updatedAt, id);
  const { body: _body, ...record } = getDocument(id)!;
  return record;
}

export function setDocumentPath(id: string, newPath: string): DocRecord | undefined {
  db.prepare("UPDATE documents SET path = ? WHERE id = ?").run(newPath, id);
  const doc = getDocument(id);
  if (!doc) return undefined;
  const { body: _body, ...record } = doc;
  return record;
}
