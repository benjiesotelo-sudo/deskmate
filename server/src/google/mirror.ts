import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MIRROR_DIR } from "../config.ts";
import { db, deleteMeta, getMeta, setMeta } from "../db.ts";
import { getDocument, hasOneCurrent, insertDocument, listDocuments, setDocumentBody, supersedeOthers, updateDocument, type DocPatch } from "../documents.ts";
import { extractText, TEXT_EXTENSIONS } from "../extract.ts";
import { adviseFiling, slugify } from "../filing.ts";
import { courses, office, peopleFile } from "../office.ts";
import { writeDocumentsFile } from "../seed.ts";
import { indexDocument } from "../tams/indexer.ts";
import { KINDS, STATUSES, type DocRecord, type Kind, type Person, type Status } from "../types.ts";
import { download, getItem, listChildren, readJson, writeJson, type DriveItem } from "./drive.ts";
import { exportFor, FOLDER_TYPE, inferRecord, parseFolderId, safeName, SIDECAR_SUFFIX, staysInDrive } from "./infer.ts";
import { GoogleError, OfflineError, type GoogleAccount } from "./oauth.ts";

// Sync keeps the cabinet current, so it pulls what Deskmate can read, up to this size.
// "Download everything" has no such limit.
const SYNC_MAX_BYTES = 25 * 1024 * 1024;
const MAX_ITEMS = 5000;
const WORKERS = 4;

export type Connection = {
  folderId: string;
  folderName: string;
  slug: string;
  link: string | null;
  accountSub: string;
  accountEmail: string;
  connectedBy: string;
  connectedAt: string;
};

type Row = {
  id: string;
  parent_id: string | null;
  name: string;
  rel_path: string;
  mime: string;
  is_folder: number;
  size: number | null;
  modified_time: string | null;
  owner_email: string | null;
  web_link: string | null;
  local_path: string | null;
  local_modified: string | null;
  doc_id: string | null;
  record_hash: string | null;
  sidecar_id: string | null;
  sidecar_modified: string | null;
  sidecar_seen: string | null;
  gone: number;
  note: string | null;
};

export type FileState = "folder" | "stays" | "local" | "changed" | "remote";

export type Job = {
  kind: "sync" | "download";
  phase: "listing" | "downloading" | "records" | "indexing" | "done" | "failed";
  startedAt: string;
  finishedAt: string | null;
  total: number;
  done: number;
  bytes: number;
  current: string | null;
  filed: number;
  updated: number;
  pushed: number;
  pulled: number;
  errors: { name: string; message: string }[];
  offline: boolean;
  message: string | null;
};

let job: Job | null = null;

export const currentJob = () => job;
export const isRunning = () => job !== null && job.finishedAt === null;

export function getConnection(): Connection | null {
  const raw = getMeta("drive_connection");
  return raw ? (JSON.parse(raw) as Connection) : null;
}

const rows = () => db.prepare("SELECT * FROM drive_files WHERE gone = 0 ORDER BY rel_path").all() as Row[];
const mirrorFile = (row: Row) => path.join(MIRROR_DIR, row.local_path ?? "");

function stateOf(row: Row): FileState {
  if (row.is_folder) return "folder";
  if (staysInDrive(row.mime)) return "stays";
  if (!row.local_modified || !fs.existsSync(mirrorFile(row))) return "remote";
  return row.local_modified === row.modified_time ? "local" : "changed";
}

function readable(row: Row): boolean {
  if (exportFor(row.mime)) return true;
  const ext = path.extname(row.name).toLowerCase();
  return (TEXT_EXTENSIONS as readonly string[]).includes(ext) && (row.size ?? 0) <= SYNC_MAX_BYTES;
}

// The five fields a person edits on a record. When they change, Drive hears about it.
const recordFields = (doc: DocRecord) => ({ title: doc.title, kind: doc.kind, course: doc.course, chapter: doc.chapter, status: doc.status });
const recordHash = (doc: DocRecord) => crypto.createHash("sha1").update(JSON.stringify(recordFields(doc))).digest("hex");

// ---------- listing ----------

type Listed = { item: DriveItem; parentId: string; parentRel: string };

async function listTree(conn: Connection): Promise<{ listed: Listed[]; sidecars: Map<string, DriveItem> }> {
  const listed: Listed[] = [];
  const sidecars = new Map<string, DriveItem>();
  let wave = [{ id: conn.folderId, rel: "" }];
  while (wave.length) {
    const next: typeof wave = [];
    for (let i = 0; i < wave.length; i += WORKERS) {
      const batch = wave.slice(i, i + WORKERS);
      const results = await Promise.all(batch.map((folder) => listChildren(conn.accountSub, folder.id)));
      results.forEach((children, n) => {
        const parent = batch[n];
        for (const item of children) {
          if (item.mimeType !== FOLDER_TYPE && item.name.endsWith(SIDECAR_SUFFIX)) {
            sidecars.set(`${parent.id}\n${item.name.slice(0, -SIDECAR_SUFFIX.length)}`, item);
            continue;
          }
          listed.push({ item, parentId: parent.id, parentRel: parent.rel });
          if (item.mimeType === FOLDER_TYPE) next.push({ id: item.id, rel: parent.rel ? `${parent.rel}/${safeName(item.name)}` : safeName(item.name) });
        }
      });
      if (listed.length > MAX_ITEMS) throw new GoogleError(400, `This folder holds more than ${MAX_ITEMS} items. Connect a smaller folder.`);
    }
    wave = next;
  }
  return { listed, sidecars };
}

// Bring the local picture of the Drive folder up to date. Nothing is downloaded here.
async function refreshListing(conn: Connection): Promise<void> {
  const { listed, sidecars } = await listTree(conn);
  const before = new Map((db.prepare("SELECT * FROM drive_files").all() as Row[]).map((r) => [r.id, r]));
  const taken = new Set<string>();
  const upsert = db.prepare(
    `INSERT INTO drive_files (id, parent_id, name, rel_path, mime, is_folder, size, modified_time, owner_email, web_link, local_path, sidecar_id, sidecar_modified, gone, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET parent_id = excluded.parent_id, name = excluded.name, rel_path = excluded.rel_path, mime = excluded.mime,
       is_folder = excluded.is_folder, size = excluded.size, modified_time = excluded.modified_time, owner_email = excluded.owner_email,
       web_link = excluded.web_link, local_path = excluded.local_path, sidecar_id = excluded.sidecar_id,
       sidecar_modified = excluded.sidecar_modified, gone = 0, note = excluded.note`,
  );
  db.exec("BEGIN");
  try {
    db.exec("UPDATE drive_files SET gone = 1");
    for (const { item, parentId, parentRel } of listed) {
      const isFolder = item.mimeType === FOLDER_TYPE;
      const relPath = parentRel ? `${parentRel}/${safeName(item.name)}` : safeName(item.name);
      let target: string | null = null;
      if (!isFolder) {
        const exported = exportFor(item.mimeType);
        const ext = exported && !relPath.toLowerCase().endsWith(exported.ext) ? exported.ext : "";
        target = `${conn.slug}/${relPath}${ext}`;
        // Drive allows two files with one name in a folder. A disk does not.
        if (taken.has(target.toLowerCase())) {
          const dot = target.lastIndexOf(".");
          const cut = dot > target.lastIndexOf("/") ? dot : target.length;
          target = `${target.slice(0, cut)} (${item.id.slice(0, 6)})${target.slice(cut)}`;
        }
        taken.add(target.toLowerCase());
        const old = before.get(item.id);
        // Renamed or moved in Drive: the local copy follows, and so does the record's path.
        if (old?.local_modified && old.local_path && old.local_path !== target && fs.existsSync(path.join(MIRROR_DIR, old.local_path))) {
          fs.mkdirSync(path.dirname(path.join(MIRROR_DIR, target)), { recursive: true });
          fs.renameSync(path.join(MIRROR_DIR, old.local_path), path.join(MIRROR_DIR, target));
          if (old.doc_id) db.prepare("UPDATE documents SET path = ? WHERE id = ?").run(`mirror/${target}`, old.doc_id);
        }
      }
      const sidecar = sidecars.get(`${parentId}\n${item.name}`);
      upsert.run(
        item.id,
        parentId,
        item.name,
        relPath,
        item.mimeType,
        isFolder ? 1 : 0,
        item.size ? Number(item.size) : null,
        item.modifiedTime ?? null,
        item.owners?.[0]?.emailAddress?.toLowerCase() ?? null,
        item.webViewLink ?? null,
        target,
        sidecar?.id ?? null,
        sidecar?.modifiedTime ?? null,
        staysInDrive(item.mimeType) ? "Stays in Drive: this kind of Google file has nothing to download." : null,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  setMeta("drive_listed_at", new Date().toISOString());
}

// ---------- connect and disconnect ----------

export async function connect(person: Person, account: GoogleAccount, input: string): Promise<Connection> {
  const folderId = parseFolderId(input);
  if (!folderId) throw new GoogleError(400, "That does not look like a Drive folder. Paste the folder's link or its ID.");
  const item = await getItem(account.sub, folderId);
  if (item.mimeType !== FOLDER_TYPE) throw new GoogleError(400, `"${item.name}" is a file, not a folder. Pick the folder that holds the office's documents.`);
  const conn: Connection = {
    folderId: item.id,
    folderName: item.name,
    slug: slugify(item.name) || "drive",
    link: item.webViewLink ?? null,
    accountSub: account.sub,
    accountEmail: account.email,
    connectedBy: person.id,
    connectedAt: new Date().toISOString(),
  };
  // Rows remembered from a different folder mean nothing here.
  if (getMeta("drive_rows_folder") !== conn.folderId) db.exec("DELETE FROM drive_files");
  setMeta("drive_rows_folder", conn.folderId);
  setMeta("drive_connection", JSON.stringify(conn));
  await refreshListing(conn);
  return conn;
}

// Stop mirroring. Everything already downloaded and filed stays in the cabinet.
export function disconnect() {
  deleteMeta("drive_connection");
}

// ---------- filing ----------

async function fileIntoCabinet(conn: Connection, row: Row, fallbackOwner: string): Promise<{ docId: string; created: boolean }> {
  const docPath = `mirror/${row.local_path}`;
  let text = "";
  try {
    text = await extractText(mirrorFile(row));
  } catch {
    text = "";
  }
  // Everything from here to the insert is synchronous, so two downloads finishing
  // together can never claim the same version number.
  const known =
    (row.doc_id && getDocument(row.doc_id)) ||
    (db.prepare("SELECT id FROM documents WHERE drive_file_id = ?").get(row.id) as { id: string } | undefined);
  if (known) {
    setDocumentBody(known.id, text, docPath);
    db.prepare("UPDATE drive_files SET doc_id = ?, record_hash = COALESCE(record_hash, ?) WHERE id = ?").run(known.id, recordHash(getDocument(known.id)!), row.id);
    return { docId: known.id, created: false };
  }

  const folders = [conn.folderName, ...row.rel_path.split("/").slice(0, -1)];
  const inferred = inferRecord(folders, row.name, row.mime, courses());
  const advice = adviseFiling({ ...inferred, extension: path.extname(row.local_path ?? "") || "bin" });
  let version = advice.version;
  let id = advice.id;
  while (getDocument(id)) id = advice.id.replace(/-v\d+$/, `-v${++version}`);
  // A slot that already has a current document keeps it. The mirrored file waits as a draft for a person to decide.
  const slotTaken = hasOneCurrent(inferred.kind) && listDocuments({ course: inferred.course, chapter: advice.chapter, kind: inferred.kind, status: "current" }).length > 0;
  const owner = peopleFile().find((p) => row.owner_email && p.email.toLowerCase() === row.owner_email)?.id ?? fallbackOwner;
  const record: DocRecord = {
    id,
    title: inferred.title,
    kind: inferred.kind,
    course: inferred.course,
    term: office().term,
    chapter: advice.chapter,
    owner,
    version,
    status: slotTaken ? "draft" : "current",
    path: docPath,
    updatedAt: new Date().toISOString(),
    mirrored: true,
    driveFileId: row.id,
  };
  insertDocument(record, text);
  db.prepare("UPDATE drive_files SET doc_id = ?, record_hash = ? WHERE id = ?").run(id, recordHash(record), row.id);
  return { docId: id, created: true };
}

// ---------- records travelling to and from Drive ----------

function applySidecar(docId: string, content: unknown): boolean {
  const record = (content as { record?: Record<string, unknown> } | null)?.record;
  if (!record || typeof record !== "object") return false;
  const patch: DocPatch = {};
  if (typeof record.title === "string" && record.title.trim()) patch.title = record.title.trim();
  if (KINDS.includes(record.kind as Kind)) patch.kind = record.kind as Kind;
  if (STATUSES.includes(record.status as Status)) patch.status = record.status as Status;
  if (typeof record.course === "string" && (record.course === "OFFICE" || courses().some((c) => c.id === record.course))) patch.course = record.course;
  if (record.chapter === null || (Number.isInteger(record.chapter) && (record.chapter as number) > 0)) patch.chapter = record.chapter as number | null;
  if (!Object.keys(patch).length) return false;
  const updated = updateDocument(docId, patch);
  if (updated) supersedeOthers(updated);
  return Boolean(updated);
}

// Local edits win. A record edited here is written next to its file in Drive as
// "<file>.deskmate.json"; a sidecar that changed in Drive is read back when the local record is untouched.
async function exchangeRecords(conn: Connection, run: Job, touched: Set<string>): Promise<void> {
  for (const row of rows()) {
    if (!row.doc_id || row.is_folder || !row.parent_id) continue;
    const doc = getDocument(row.doc_id);
    if (!doc) continue;
    const hash = recordHash(doc);
    if (hash !== row.record_hash) {
      run.current = `${row.name}${SIDECAR_SUFFIX}`;
      const written = await writeJson(conn.accountSub, {
        id: row.sidecar_id,
        name: `${row.name}${SIDECAR_SUFFIX}`,
        parentId: row.parent_id,
        content: { deskmate: 1, file: row.name, driveFileId: row.id, record: { ...recordFields(doc), term: doc.term, version: doc.version }, updatedAt: doc.updatedAt },
      });
      db.prepare("UPDATE drive_files SET sidecar_id = ?, sidecar_modified = ?, sidecar_seen = ?, record_hash = ? WHERE id = ?").run(
        written.id,
        written.modifiedTime,
        written.modifiedTime,
        hash,
        row.id,
      );
      run.pushed++;
    } else if (row.sidecar_id && row.sidecar_modified !== row.sidecar_seen) {
      run.current = `${row.name}${SIDECAR_SUFFIX}`;
      const changed = applySidecar(doc.id, await readJson(conn.accountSub, row.sidecar_id));
      db.prepare("UPDATE drive_files SET sidecar_seen = ?, record_hash = ? WHERE id = ?").run(row.sidecar_modified, recordHash(getDocument(doc.id)!), row.id);
      if (changed) {
        run.pulled++;
        touched.add(doc.id);
      }
    }
  }
}

// ---------- the job ----------

function plain(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function work(run: Job, conn: Connection, personId: string): Promise<void> {
  await refreshListing(conn);

  const all = rows();
  const wanted = all.filter((row) => {
    const state = stateOf(row);
    if (state !== "remote" && state !== "changed") return false;
    return run.kind === "download" || readable(row);
  });
  // Local copies that lost their record, for example after the demo was reset, are filed again without a download.
  const unfiled = all.filter((row) => stateOf(row) === "local" && !(row.doc_id && getDocument(row.doc_id)));
  run.total = wanted.length + unfiled.length;
  run.phase = "downloading";

  const touched = new Set<string>();
  const queue = [...wanted.map((row) => ({ row, fetch: true })), ...unfiled.map((row) => ({ row, fetch: false }))];
  const stop: { offline: OfflineError | null } = { offline: null };
  const worker = async () => {
    for (let next = queue.shift(); next && !stop.offline; next = queue.shift()) {
      const { row } = next;
      run.current = row.rel_path;
      try {
        if (next.fetch) {
          await download(conn.accountSub, row, mirrorFile(row), (n) => (run.bytes += n));
          db.prepare("UPDATE drive_files SET local_modified = ?, note = NULL WHERE id = ?").run(row.modified_time, row.id);
        }
        const filed = await fileIntoCabinet(conn, row, personId);
        touched.add(filed.docId);
        if (filed.created) run.filed++;
        else run.updated++;
      } catch (error) {
        if (error instanceof OfflineError) {
          stop.offline = error;
          return;
        }
        run.errors.push({ name: row.rel_path, message: plain(error) });
        db.prepare("UPDATE drive_files SET note = ? WHERE id = ?").run(plain(error), row.id);
      }
      run.done++;
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));

  try {
    if (stop.offline) throw stop.offline;
    run.phase = "records";
    await exchangeRecords(conn, run, touched);
  } finally {
    // Whatever arrived is kept, filed and searchable, even when the connection dropped half way.
    run.current = null;
    if (touched.size) {
      writeDocumentsFile();
      run.phase = "indexing";
      for (const id of touched) await indexDocument(id);
    }
  }
  setMeta("drive_synced_at", new Date().toISOString());
}

// Start a sync or a full download in the background. The Drive screen follows it through status().
export function start(kind: Job["kind"], person: Person): Job {
  const conn = getConnection();
  if (!conn) throw new GoogleError(400, "Connect a Drive folder first.");
  if (isRunning()) return job!;
  const run: Job = {
    kind,
    phase: "listing",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total: 0,
    done: 0,
    bytes: 0,
    current: null,
    filed: 0,
    updated: 0,
    pushed: 0,
    pulled: 0,
    errors: [],
    offline: false,
    message: null,
  };
  job = run;
  void work(run, conn, person.id)
    .then(() => {
      run.phase = "done";
    })
    .catch((error: unknown) => {
      run.phase = "failed";
      run.offline = error instanceof OfflineError;
      run.message = run.offline ? "The internet dropped. What was already downloaded is safe, and the cabinet and Tams keep working." : plain(error);
    })
    .finally(() => {
      run.current = null;
      run.finishedAt = new Date().toISOString();
    });
  return run;
}

// For tests and scripts: run a job and wait for it.
export async function runToEnd(kind: Job["kind"], person: Person): Promise<Job> {
  const run = start(kind, person);
  while (run.finishedAt === null) await new Promise((resolve) => setTimeout(resolve, 20));
  return run;
}

// ---------- what the Drive screen shows ----------

export type TreeEntry = {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  isFolder: boolean;
  state: FileState;
  size: number | null;
  modifiedTime: string | null;
  link: string | null;
  note: string | null;
  doc: { id: string; title: string; course: string; chapter: number | null; kind: Kind; status: Status; recordPending: boolean } | null;
};

export function tree(): TreeEntry[] {
  return rows().map((row) => {
    const doc = row.doc_id ? getDocument(row.doc_id) : undefined;
    return {
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      path: row.rel_path,
      isFolder: Boolean(row.is_folder),
      state: stateOf(row),
      size: row.size,
      modifiedTime: row.modified_time,
      link: row.web_link,
      note: row.note,
      doc: doc
        ? { id: doc.id, title: doc.title, course: doc.course, chapter: doc.chapter, kind: doc.kind, status: doc.status, recordPending: recordHash(doc) !== row.record_hash }
        : null,
    };
  });
}

export function summary() {
  const conn = getConnection();
  const counts = { files: 0, local: 0, notLocal: 0, changed: 0, staysInDrive: 0, filed: 0, recordsToSend: 0 };
  if (conn) {
    for (const row of rows()) {
      const state = stateOf(row);
      if (state === "folder") continue;
      if (state === "stays") {
        counts.staysInDrive++;
        continue;
      }
      counts.files++;
      if (state === "local") counts.local++;
      else counts.notLocal++;
      if (state === "changed") counts.changed++;
      const doc = row.doc_id ? getDocument(row.doc_id) : undefined;
      if (doc) {
        counts.filed++;
        if (recordHash(doc) !== row.record_hash) counts.recordsToSend++;
      }
    }
  }
  const statusLine = !conn
    ? "No Drive folder is connected."
    : counts.files === 0
      ? "This Drive folder has no files to download."
      : counts.notLocal === 0
        ? "Everything downloaded - works offline"
        : `${counts.notLocal} ${counts.notLocal === 1 ? "file" : "files"} not yet local`;
  return {
    connection: conn,
    counts,
    statusLine,
    lastSync: getMeta("drive_synced_at") ?? null,
    lastListed: getMeta("drive_listed_at") ?? null,
    mirrorFolder: conn ? path.join(MIRROR_DIR, conn.slug) : null,
    job,
  };
}
