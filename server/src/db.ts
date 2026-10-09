import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "./config.ts";

if (DB_PATH !== ":memory:") fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  person_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  course TEXT NOT NULL,
  term TEXT NOT NULL,
  chapter INTEGER,
  owner TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  path TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS documents_slot ON documents (course, chapter, kind);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  ord INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding TEXT
);
CREATE INDEX IF NOT EXISTS chunks_source ON chunks (source_type, source_id);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export function getMeta(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(key: string, value: string) {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
