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
-- A Google account that has signed in. The refresh token stays here, on this machine.
CREATE TABLE IF NOT EXISTS google_accounts (
  sub TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  refresh_token TEXT,
  scope TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
-- One row for everything listed in the connected Drive folder.
CREATE TABLE IF NOT EXISTS drive_files (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  is_folder INTEGER NOT NULL DEFAULT 0,
  size INTEGER,
  modified_time TEXT,
  owner_email TEXT,
  web_link TEXT,
  local_path TEXT,
  local_modified TEXT,
  doc_id TEXT,
  record_hash TEXT,
  sidecar_id TEXT,
  sidecar_modified TEXT,
  sidecar_seen TEXT,
  gone INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
`);

// The filing schema gains exactly two columns for the Drive mirror.
const documentColumns = (db.prepare("PRAGMA table_info(documents)").all() as { name: string }[]).map((c) => c.name);
if (!documentColumns.includes("mirrored")) db.exec("ALTER TABLE documents ADD COLUMN mirrored INTEGER NOT NULL DEFAULT 0");
if (!documentColumns.includes("drive_file_id")) db.exec("ALTER TABLE documents ADD COLUMN drive_file_id TEXT");

export function getMeta(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function deleteMeta(key: string) {
  db.prepare("DELETE FROM meta WHERE key = ?").run(key);
}

export function setMeta(key: string, value: string) {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
