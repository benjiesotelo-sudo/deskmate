import fs from "node:fs";
import path from "node:path";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { CHAT_MODEL, EMBED_MODEL, OFFICE_DIR } from "./config.ts";
import { currentPerson, endSession, requireAdmin, requireAuth, signIn, startSession } from "./auth.ts";
import { db, getMeta } from "./db.ts";
import { getDocument, insertDocument, listDocuments, setDocumentPath, updateDocument, type DocPatch } from "./documents.ts";
import { extractText, TEXT_EXTENSIONS } from "./extract.ts";
import { adviseFiling, canonicalPath } from "./filing.ts";
import { courses, office, officePath, peopleFile, processes, writeProcess } from "./office.ts";
import { checkProcess } from "./processes.ts";
import { computeReadiness } from "./readiness.ts";
import { writeDocumentsFile } from "./seed.ts";
import { answer, type Mode, type Turn } from "./tams/chat.ts";
import { cloudStatus } from "./tams/cloud.ts";
import { indexDocument, indexProcess, indexSummary, isBuilding, rebuildIndex } from "./tams/indexer.ts";
import { ollamaState } from "./tams/ollama.ts";
import { KINDS, STATUSES, type DocRecord, type Kind, type Person, type Status } from "./types.ts";

export const api = Router();
const json = express.json({ limit: "30mb" });

const me = (res: Response) => res.locals.person as Person;
const publicPerson = (p: Person) => ({ id: p.id, username: p.username, name: p.name, role: p.role, access: p.access, email: p.email });

// People with "owns" computed from the live records, so a handover shows up everywhere at once.
function peopleWithOwnership(): Person[] {
  const docs = listDocuments();
  const procs = processes();
  return peopleFile().map((p) => ({
    ...p,
    owns: {
      documents: docs.filter((d) => d.owner === p.id).map((d) => d.id),
      processes: procs.filter((pr) => pr.owner === p.id).map((pr) => pr.id),
    },
  }));
}

// ---------- sign-in ----------

api.post("/auth/login", json, (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    res.status(400).json({ error: "Enter your username and password." });
    return;
  }
  const person = signIn(username, password);
  if (!person) {
    res.status(401).json({ error: "That username and password do not match an account." });
    return;
  }
  startSession(res, person.id);
  res.json({ person: publicPerson(person) });
});

api.post("/auth/logout", (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

api.get("/api/me", (req, res) => {
  const person = currentPerson(req);
  res.json({ person: person ? publicPerson(person) : null, office: office() });
});

api.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Everything below needs a signed-in person.
api.use("/api", requireAuth);

// ---------- the data contract shared with the office and Google modules ----------

api.get("/api/people", (_req, res) => {
  res.json(peopleWithOwnership());
});

api.get("/api/courses", (_req, res) => {
  res.json(courses());
});

api.get("/api/processes", (_req, res) => {
  res.json(processes());
});

api.get("/api/processes/:id", (req, res) => {
  const found = processes().find((p) => p.id === req.params.id);
  if (!found) {
    res.status(404).json({ error: "No process with that id." });
    return;
  }
  res.json(found);
});

// Saves a whole process from the editor into the working copy, then re-reads it for Tams.
api.put("/api/processes/:id", json, async (req, res) => {
  const existing = processes().find((p) => p.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: "No process with that id." });
    return;
  }
  const checked = checkProcess(req.body, {
    existing,
    person: me(res),
    personIds: new Set(peopleFile().map((p) => p.id)),
    documentIds: new Set(listDocuments().map((d) => d.id)),
  });
  if ("error" in checked) {
    res.status(checked.status ?? 400).json({ error: checked.error });
    return;
  }
  writeProcess(checked.process);
  await indexProcess(checked.process.id);
  res.json(checked.process);
});

api.get("/api/documents", (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  let chapter: number | null | undefined;
  if (q.chapter === "none" || q.chapter === "null") chapter = null;
  else if (q.chapter) chapter = Number(q.chapter);
  if (chapter !== undefined && chapter !== null && !Number.isInteger(chapter)) {
    res.status(400).json({ error: "chapter must be a number, or 'none' for course-wide documents." });
    return;
  }
  res.json(
    listDocuments({
      course: q.course || undefined,
      chapter,
      kind: q.kind || undefined,
      status: q.status || undefined,
      owner: q.scope === "mine" ? me(res).id : q.owner || undefined,
    }),
  );
});

api.get("/api/documents/:id", (req, res) => {
  const doc = getDocument(String(req.params.id));
  if (!doc) {
    res.status(404).json({ error: "No document with that id." });
    return;
  }
  const { body, ...record } = doc;
  const versions = listDocuments({ course: doc.course, chapter: doc.chapter, kind: doc.kind }).filter(
    (d) => d.id.replace(/-v\d+$/, "") === doc.id.replace(/-v\d+$/, ""),
  );
  const person = me(res);
  res.json({
    ...record,
    text: body,
    fileName: path.basename(doc.path),
    fileExists: fs.existsSync(officePath(doc.path)),
    versions,
    canEdit: person.access === "admin" || doc.owner === person.id,
  });
});

api.get("/api/documents/:id/file", (req, res) => {
  const doc = getDocument(String(req.params.id));
  if (!doc) {
    res.status(404).json({ error: "No document with that id." });
    return;
  }
  const file = officePath(doc.path);
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: "The record exists but its file is missing from the office folder." });
    return;
  }
  // dotfiles: allow, because the repo itself may live under a dot folder.
  res.download(file, path.basename(file), { dotfiles: "allow" });
});

function validCourse(id: string): boolean {
  return id === "OFFICE" || courses().some((c) => c.id === id);
}

function readPatch(body: Record<string, unknown>, person: Person): { patch: DocPatch } | { error: string; status?: number } {
  const patch: DocPatch = {};
  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) return { error: "The title cannot be empty." };
    patch.title = body.title.trim();
  }
  if ("kind" in body) {
    if (!KINDS.includes(body.kind as Kind)) return { error: `kind must be one of: ${KINDS.join(", ")}.` };
    patch.kind = body.kind as Kind;
  }
  if ("course" in body) {
    if (typeof body.course !== "string" || !validCourse(body.course)) return { error: "That course is not in the office's course list." };
    patch.course = body.course;
  }
  if ("term" in body) {
    if (typeof body.term !== "string" || !body.term.trim()) return { error: "The term cannot be empty." };
    patch.term = body.term.trim();
  }
  if ("chapter" in body) {
    const chapter = body.chapter === null || body.chapter === "" ? null : Number(body.chapter);
    if (chapter !== null && (!Number.isInteger(chapter) || chapter < 1)) return { error: "chapter must be a whole number, or empty for course-wide documents." };
    patch.chapter = chapter;
  }
  if ("owner" in body) {
    if (typeof body.owner !== "string" || !peopleFile().some((p) => p.id === body.owner)) return { error: "The owner must be a person in this office." };
    patch.owner = body.owner;
  }
  if ("version" in body) {
    const version = Number(body.version);
    if (!Number.isInteger(version) || version < 1) return { error: "version must be a whole number from 1 up." };
    patch.version = version;
  }
  if ("status" in body) {
    if (!STATUSES.includes(body.status as Status)) return { error: `status must be one of: ${STATUSES.join(", ")}.` };
    patch.status = body.status as Status;
  }
  if (patch.owner && person.access !== "admin") return { error: "Only an office admin can hand a document to a new owner.", status: 403 };
  return { patch };
}

// One current document per course, chapter and kind. Marking a new one current
// retires the old one to "superseded" in the same step.
const ONE_CURRENT: Kind[] = ["syllabus", "deck", "materials", "quiz", "book"];
function supersedeOthers(doc: DocRecord): string[] {
  if (doc.status !== "current" || !ONE_CURRENT.includes(doc.kind)) return [];
  const others = listDocuments({ course: doc.course, chapter: doc.chapter, kind: doc.kind, status: "current" }).filter((d) => d.id !== doc.id);
  for (const other of others) updateDocument(other.id, { status: "superseded" });
  return others.map((d) => d.id);
}

api.patch("/api/documents/:id", json, (req, res) => {
  const id = String(req.params.id);
  const doc = getDocument(id);
  if (!doc) {
    res.status(404).json({ error: "No document with that id." });
    return;
  }
  const person = me(res);
  if (person.access !== "admin" && doc.owner !== person.id) {
    res.status(403).json({ error: "You can edit only the documents you own. Ask an office admin for anything else." });
    return;
  }
  const parsed = readPatch((req.body ?? {}) as Record<string, unknown>, person);
  if ("error" in parsed) {
    res.status(parsed.status ?? 400).json({ error: parsed.error });
    return;
  }
  let updated = updateDocument(id, parsed.patch)!;
  // Keep the file where the record says it belongs: if the course, chapter,
  // kind or version changed, the file moves to its new folder and name.
  const target = canonicalPath(updated);
  if (target !== updated.path && fs.existsSync(officePath(updated.path)) && !fs.existsSync(officePath(target))) {
    fs.mkdirSync(path.dirname(officePath(target)), { recursive: true });
    fs.renameSync(officePath(updated.path), officePath(target));
    updated = setDocumentPath(id, target)!;
  }
  const superseded = supersedeOthers(updated);
  writeDocumentsFile();
  if (parsed.patch.title && parsed.patch.title !== doc.title) void indexDocument(id);
  res.json({ ...updated, superseded });
});

api.get("/api/filing/advice", (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  if (!q.course || !validCourse(q.course) || !KINDS.includes(q.kind as Kind)) {
    res.status(400).json({ error: "Pick a course and a kind first." });
    return;
  }
  const chapter = q.chapter && q.chapter !== "none" ? Number(q.chapter) : null;
  res.json(adviseFiling({ course: q.course, chapter, kind: q.kind as Kind, title: q.title, extension: q.extension }));
});

api.post("/api/documents", json, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const person = me(res);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const kind = body.kind as Kind;
  const course = typeof body.course === "string" ? body.course : "";
  const status = (body.status as Status) ?? "draft";
  const owner = typeof body.owner === "string" && body.owner ? body.owner : person.id;
  const chapter = body.chapter === null || body.chapter === undefined || body.chapter === "" ? null : Number(body.chapter);
  if (!title) return void res.status(400).json({ error: "Give the document a title." });
  if (!KINDS.includes(kind)) return void res.status(400).json({ error: "Pick what kind of document this is." });
  if (!validCourse(course)) return void res.status(400).json({ error: "Pick the course this belongs to." });
  if (!STATUSES.includes(status)) return void res.status(400).json({ error: "Pick a status." });
  if (!peopleFile().some((p) => p.id === owner)) return void res.status(400).json({ error: "The owner must be a person in this office." });
  if (chapter !== null && (!Number.isInteger(chapter) || chapter < 1)) return void res.status(400).json({ error: "The chapter must be a whole number." });

  let content: Buffer;
  let extension: string;
  if (typeof body.contentBase64 === "string" && typeof body.fileName === "string") {
    extension = path.extname(body.fileName).toLowerCase();
    if (!(TEXT_EXTENSIONS as readonly string[]).includes(extension)) {
      return void res.status(400).json({ error: "Deskmate files markdown, text, PDF and Word (.docx) documents." });
    }
    content = Buffer.from(body.contentBase64, "base64");
  } else if (typeof body.text === "string" && body.text.trim()) {
    extension = ".md";
    content = Buffer.from(body.text, "utf8");
  } else {
    return void res.status(400).json({ error: "Attach a file or write the document text." });
  }

  const advice = adviseFiling({ course, chapter, kind, title, extension });
  const file = officePath(advice.path);
  if (fs.existsSync(file) || getDocument(advice.id)) {
    return void res.status(409).json({ error: `Something is already filed as ${advice.fileName}. Change the title or file a new version.` });
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);

  const record: DocRecord = {
    id: advice.id,
    title,
    kind,
    course,
    term: typeof body.term === "string" && body.term.trim() ? body.term.trim() : office().term,
    chapter: advice.chapter,
    owner,
    version: advice.version,
    status,
    path: advice.path,
    updatedAt: new Date().toISOString(),
  };
  let text = "";
  try {
    text = await extractText(file);
  } catch {
    text = "";
  }
  insertDocument(record, text);
  const superseded = supersedeOthers(record);
  writeDocumentsFile();
  await indexDocument(record.id);
  res.status(201).json({ ...record, superseded, textExtracted: Boolean(text.trim()) });
});

// ---------- accreditation readiness ----------

api.get("/api/readiness", (_req, res) => {
  res.json(computeReadiness(courses(), listDocuments()));
});

// ---------- Tams ----------

api.get("/api/tams/status", async (_req, res) => {
  const [local, cloud] = await Promise.all([ollamaState(), cloudStatus()]);
  const index = indexSummary();
  res.json({
    local: {
      reachable: local.reachable,
      chatModel: CHAT_MODEL,
      chatReady: local.chatReady,
      embedModel: EMBED_MODEL,
      embedReady: local.embedReady,
    },
    cloud,
    index: {
      ...index,
      building: isBuilding(),
      builtAt: getMeta("index_built_at") ?? null,
      search: index.chunks === 0 ? "empty" : index.embedded === index.chunks ? "embeddings" : index.embedded > 0 ? "partial" : "keywords",
    },
  });
});

// Streams the answer as plain text. When the answer is complete, one record
// separator character (0x1E) follows, then a single JSON frame:
// { sources: [{ docId, title }], processId?, ... }
export const FRAME_SEPARATOR = "\u001e";

api.post("/api/tams/chat", json, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { messages?: unknown; mode?: unknown };
  const mode: Mode = body.mode === "cloud" ? "cloud" : "local";
  const turns: Turn[] = Array.isArray(body.messages)
    ? body.messages
        .filter((m): m is Turn => Boolean(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
  if (!turns.length || turns.at(-1)!.role !== "user") {
    res.status(400).json({ error: "Send messages ending with a user message." });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  try {
    const frame = await answer(turns, mode, (text) => res.write(text), abort.signal);
    res.write(FRAME_SEPARATOR + JSON.stringify(frame));
  } catch (error) {
    if (!abort.signal.aborted) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      res.write(FRAME_SEPARATOR + JSON.stringify({ sources: [], processes: [], mode, error: message }));
    }
  }
  res.end();
});

// ---------- admin ----------

api.post("/api/admin/reindex", requireAdmin, async (_req, res) => {
  const summary = await rebuildIndex();
  res.json(summary);
});

api.get("/api/admin/storage", requireAdmin, (_req, res) => {
  const docs = db.prepare("SELECT COUNT(*) AS n FROM documents").get() as { n: number };
  res.json({ officeFolder: OFFICE_DIR, documents: Number(docs.n) });
});

api.use("/api", (_req, res) => {
  res.status(404).json({ error: "No such endpoint." });
});

// Errors come back in the same shape as everything else: { error: "a sentence a person can read" }.
api.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const type = (error as { type?: string } | null)?.type;
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "That request was not valid JSON." });
  } else if (type === "entity.too.large") {
    res.status(413).json({ error: "That is too large to send in one go. The limit is 30 MB." });
  } else {
    console.error(error);
    res.status(500).json({ error: "Deskmate hit a problem on this machine. Try again." });
  }
});
