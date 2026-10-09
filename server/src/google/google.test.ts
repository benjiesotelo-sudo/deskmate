import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import { files, google, googleEnv, googleUrl, tick } from "./testing/fake-google.ts";

// The app's own port is taken first, because the address Google sends people back to is fixed at start-up.
const app = http.createServer();
await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
const appUrl = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "deskmate-google-"));
Object.assign(process.env, {
  DESKMATE_DB: ":memory:",
  DESKMATE_OFFICE_DIR: path.join(tmp, "office"),
  DESKMATE_MIRROR_DIR: path.join(tmp, "mirror"),
  OLLAMA_HOST: "http://127.0.0.1:9",
  GOOGLE_REDIRECT_URI: `${appUrl}/auth/google/callback`,
  ...googleEnv,
});

const { default: express } = await import("express");
const { googleRouter } = await import("../google.ts");
const { seed } = await import("../seed.ts");
const { db } = await import("../db.ts");
const { getDocument, listDocuments, updateDocument } = await import("../documents.ts");
const { peopleFile } = await import("../office.ts");
const { computeReadiness } = await import("../readiness.ts");
const { courses } = await import("../office.ts");
const { currentJob } = await import("./mirror.ts");
const { inferRecord, parseFolderId } = await import("./infer.ts");

before(async () => {
  await seed();
  app.on("request", express().use(googleRouter));
});
after(() => {
  app.close();
  google.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const call = (pathname: string, init: RequestInit & { cookie?: string } = {}) =>
  fetch(`${appUrl}${pathname}`, { ...init, redirect: "manual", headers: { Accept: "text/html", Cookie: init.cookie ?? "", ...init.headers } });
const cookieFrom = (res: Response, name: string) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith(`${name}=`) && c.length > name.length + 1);

async function googleSignIn(email: string, extra = "", cookie = ""): Promise<{ session?: string; location: string }> {
  const start = await call(`/auth/google${extra}`, { cookie });
  assert.equal(start.status, 302);
  const target = new URL(start.headers.get("location")!);
  assert.equal(target.origin + target.pathname, `${googleUrl}/auth`);
  assert.equal(target.searchParams.get("scope"), "openid email profile https://www.googleapis.com/auth/drive");
  assert.equal(target.searchParams.get("access_type"), "offline");
  const state = cookieFrom(start, "deskmate_oauth")!;
  const back = await call(`/auth/google/callback?code=code-${email}&state=${target.searchParams.get("state")}`, { cookie: `${state}; ${cookie}` });
  return { session: cookieFrom(back, "deskmate_session"), location: back.headers.get("location")! };
}

const api = async (session: string, pathname: string, method = "GET", body?: unknown) => {
  const res = await call(pathname, {
    method,
    cookie: session,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as Record<string, any> };
};

async function finish(session: string): Promise<Record<string, any>> {
  for (;;) {
    const { data } = await api(session, "/api/drive/status");
    if (data.job?.finishedAt) return data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("a folder path becomes a filing record", () => {
  const list = courses();
  assert.deepEqual(inferRecord(["Shared", "BUS101", "Chapter 4"], "Quiz final.docx", "", list), { title: "Quiz final", kind: "quiz", course: "BUS101", chapter: 4 });
  assert.deepEqual(inferRecord(["Office", "Personal Finance Basics"], "FIN201_ch02_deck_v3.pdf", "", list), { title: "FIN201_ch02_deck_v3", kind: "deck", course: "FIN201", chapter: 2 });
  assert.deepEqual(inferRecord(["MKT 150"], "Syllabus chapter 2 draft.md", "", list), { title: "Syllabus chapter 2 draft", kind: "syllabus", course: "MKT150", chapter: null });
  assert.deepEqual(inferRecord(["BUS101", "ch03"], "Untitled", "application/vnd.google-apps.presentation", list), { title: "Untitled", kind: "deck", course: "BUS101", chapter: 3 });
  assert.deepEqual(inferRecord(["BUS101", "Chapter 2"], "Scan 0042.pdf", "", list), { title: "Scan 0042", kind: "materials", course: "BUS101", chapter: 2 });
  assert.deepEqual(inferRecord(["Admin"], "Leave checklist.md", "", list), { title: "Leave checklist", kind: "process", course: "OFFICE", chapter: null });
  assert.deepEqual(inferRecord(["Photos"], "Team lunch.jpg", "", list), { title: "Team lunch", kind: "other", course: "OFFICE", chapter: null });
});

test("a folder link or a bare id both name the folder", () => {
  assert.equal(parseFolderId("https://drive.google.com/drive/folders/1AbC_dEf-123456?usp=sharing"), "1AbC_dEf-123456");
  assert.equal(parseFolderId("https://drive.google.com/drive/u/0/folders/1AbC_dEf-123456"), "1AbC_dEf-123456");
  assert.equal(parseFolderId("https://drive.google.com/open?id=1AbC_dEf-123456"), "1AbC_dEf-123456");
  assert.equal(parseFolderId(" 1AbC_dEf-123456 "), "1AbC_dEf-123456");
  assert.equal(parseFolderId("not a folder"), null);
});

let staff = "";

test("Google sign-in: a known email is that person, an unknown email is a new staff account", async () => {
  const known = await googleSignIn("marisol@deskmate.example");
  assert.equal(known.location, "/");
  const row = db.prepare("SELECT person_id FROM sessions WHERE token = ?").get(known.session!.split("=")[1]) as { person_id: string };
  assert.equal(row.person_id, "marisol");

  const before = peopleFile().length;
  const fresh = await googleSignIn("captain@example.com");
  staff = fresh.session!;
  const people = peopleFile();
  assert.equal(people.length, before + 1);
  const added = people.at(-1)!;
  assert.deepEqual([added.id, added.access, added.email], ["captain", "staff", "captain@example.com"]);
  assert.ok(people.slice(0, -1).every((p) => p.desk.x !== added.desk.x || p.desk.y !== added.desk.y));

  // Signing in again finds the same account and does not add another person.
  await googleSignIn("captain@example.com");
  assert.equal(peopleFile().length, before + 1);
});

test("the refresh token is stored on the server and never reaches the browser", async () => {
  const stored = db.prepare("SELECT refresh_token FROM google_accounts WHERE email = ?").get("captain@example.com") as { refresh_token: string };
  assert.equal(stored.refresh_token, "rt-captain@example.com");
  const status = await call("/auth/google/status", { cookie: staff, headers: { Accept: "application/json" } });
  const text = await status.text();
  assert.ok(!/rt-|at-/.test(text));
  assert.deepEqual(JSON.parse(text).account, { email: "captain@example.com", name: "Test Person", driveGranted: true, connected: true });
});

test("a callback with the wrong state is turned away", async () => {
  const start = await call("/auth/google");
  const state = cookieFrom(start, "deskmate_oauth")!;
  const back = await call("/auth/google/callback?code=code-mallory@example.com&state=forged", { cookie: state });
  assert.equal(back.headers.get("location"), "/signin?google=expired");
  assert.equal(cookieFrom(back, "deskmate_session"), undefined);
});

test("a signed-in person can link a Google account to the account they already have", async () => {
  const login = db.prepare("INSERT INTO sessions (token, person_id, expires_at) VALUES ('bea-token', 'bea', ?)");
  login.run(Date.now() + 60_000);
  const linked = await googleSignIn("bea.personal@example.com", "?link=1", "deskmate_session=bea-token");
  assert.equal(linked.location, "/settings?google=connected");
  const row = db.prepare("SELECT person_id FROM google_accounts WHERE email = ?").get("bea.personal@example.com") as { person_id: string };
  assert.equal(row.person_id, "bea");
  // From now on that Google account signs in as Bea.
  const again = await googleSignIn("bea.personal@example.com");
  const session = db.prepare("SELECT person_id FROM sessions WHERE token = ?").get(again.session!.split("=")[1]) as { person_id: string };
  assert.equal(session.person_id, "bea");
});

test("connecting a folder lists it without downloading anything", async () => {
  const bad = await api(staff, "/api/drive/connect", "POST", { folder: "quiz-4" });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /is a file, not a folder/);

  const { status, data } = await api(staff, "/api/drive/connect", "POST", { folder: "https://drive.google.com/drive/folders/root-folder-1" });
  assert.equal(status, 200);
  assert.equal(data.connection.folderName, "Deskmate Demo Drive");
  assert.equal(data.statusLine, "4 files not yet local");
  assert.deepEqual(data.counts, { files: 4, local: 0, notLocal: 4, changed: 0, staysInDrive: 1, filed: 0, recordsToSend: 0 });
  const tree = (await api(staff, "/api/drive/tree")).data as unknown as { path: string; state: string }[];
  assert.deepEqual(
    tree.map((t) => `${t.path} ${t.state}`),
    [
      "Admin folder",
      "Admin/Leave form stays",
      "Admin/Office floor plan.png remote",
      "BUS101 folder",
      "BUS101/Chapter 1 folder",
      "BUS101/Chapter 1/Chapter 1 slides.md remote",
      "BUS101/Chapter 4 folder",
      "BUS101/Chapter 4/BUS101 Chapter 4 Quiz.md remote",
      "BUS101/Chapter 4/Reading notes remote",
    ],
  );
});

test("sync pulls what Deskmate can read and files it from the folder path", async () => {
  const gaps = () => computeReadiness(courses(), listDocuments()).courses.find((c) => c.id === "BUS101")!.gaps.length;
  const gapsBefore = gaps();
  assert.equal((await api(staff, "/api/drive/sync", "POST")).status, 202);
  const done = await finish(staff);
  assert.equal(done.job.phase, "done");
  assert.deepEqual([done.job.total, done.job.done, done.job.filed, done.job.errors.length], [3, 3, 3, 0]);
  assert.equal(done.statusLine, "1 file not yet local");
  assert.ok(done.lastSync);

  const mirror = path.join(tmp, "mirror", "deskmate-demo-drive");
  assert.ok(fs.existsSync(path.join(mirror, "BUS101", "Chapter 4", "BUS101 Chapter 4 Quiz.md")));
  assert.ok(fs.existsSync(path.join(mirror, "BUS101", "Chapter 4", "Reading notes.docx")));
  assert.ok(!fs.existsSync(path.join(mirror, "Admin", "Office floor plan.png")));

  // The quiz fills an empty slot, so it is current and readiness goes up.
  const quiz = getDocument("bus101-ch04-quiz-v1")!;
  assert.deepEqual(
    [quiz.title, quiz.kind, quiz.course, quiz.chapter, quiz.status, quiz.mirrored, quiz.driveFileId, quiz.owner],
    ["BUS101 Chapter 4 Quiz", "quiz", "BUS101", 4, "current", true, "quiz-4", "captain"],
  );
  assert.match(quiz.body, /pineapple ledger/);
  assert.equal(gaps(), gapsBefore - 1);

  // The slides land on a slot that already has a current deck, so they wait as a draft and replace nothing.
  const deck = listDocuments({ course: "BUS101", chapter: 1, kind: "deck" });
  assert.deepEqual(deck.map((d) => `${d.id} ${d.status} ${Boolean(d.mirrored)}`), ["bus101-ch01-deck-v3 draft true", "bus101-ch01-deck-v2 current false", "bus101-ch01-deck-v1 superseded false"]);

  // A Google Doc is exported to Word, read, and owned by the person whose Drive file it is.
  const notes = listDocuments({ course: "BUS101", chapter: 4 }).find((d) => d.driveFileId === "gdoc-1")!;
  assert.deepEqual([notes.kind, notes.owner, notes.path], ["materials", "rafael", "mirror/deskmate-demo-drive/BUS101/Chapter 4/Reading notes.docx"]);
  assert.ok(getDocument(notes.id)!.body.length > 100);

  // Tams' index has the mirrored quiz.
  const chunks = db.prepare("SELECT COUNT(*) AS n FROM chunks WHERE source_id = ?").get(quiz.id) as { n: number };
  assert.ok(Number(chunks.n) > 0);
});

test("download everything fetches the rest and says the folder works offline", async () => {
  assert.equal((await api(staff, "/api/drive/download", "POST")).status, 202);
  const done = await finish(staff);
  assert.deepEqual([done.job.kind, done.job.phase, done.job.total, done.job.done], ["download", "done", 1, 1]);
  assert.equal(done.statusLine, "Everything downloaded - works offline");
  assert.ok(fs.existsSync(path.join(tmp, "mirror", "deskmate-demo-drive", "Admin", "Office floor plan.png")));
  assert.equal(done.counts.filed, 4);
});

test("a record edited locally goes back to Drive as a sidecar, and a changed file comes down again", async () => {
  updateDocument("bus101-ch04-quiz-v1", { title: "Chapter 4 quiz, checked", status: "draft" });
  files.get("deck-1")!.content = Buffer.from("# Slides from Drive, second edition\n");
  files.get("deck-1")!.modifiedTime = tick();
  assert.equal((await api(staff, "/api/drive/status")).data.counts.recordsToSend, 1);

  await api(staff, "/api/drive/sync", "POST");
  const done = await finish(staff);
  assert.deepEqual([done.job.phase, done.job.pushed, done.job.updated, done.job.filed], ["done", 1, 1, 0]);
  const sidecar = [...files.values()].find((f) => f.name === "BUS101 Chapter 4 Quiz.md.deskmate.json")!;
  assert.deepEqual(sidecar.parents, ["f-bus-4"]);
  const written = JSON.parse(sidecar.content!.toString());
  assert.deepEqual(written.record, { title: "Chapter 4 quiz, checked", kind: "quiz", course: "BUS101", chapter: 4, status: "draft", term: quiz().term, version: 1 });
  assert.match(getDocument("bus101-ch01-deck-v3")!.body, /second edition/);

  // The sidecar is not mistaken for a document, and an unchanged record is not sent twice.
  await api(staff, "/api/drive/sync", "POST");
  const again = await finish(staff);
  assert.deepEqual([again.job.pushed, again.job.pulled, again.job.total, again.counts.files], [0, 0, 0, 4]);

  // An edit made to the sidecar in Drive comes back while the local record is untouched.
  sidecar.content = Buffer.from(JSON.stringify({ record: { title: "Chapter 4 quiz, final", status: "current" } }));
  sidecar.modifiedTime = tick();
  await api(staff, "/api/drive/sync", "POST");
  const pulled = await finish(staff);
  assert.equal(pulled.job.pulled, 1);
  assert.deepEqual([quiz().title, quiz().status], ["Chapter 4 quiz, final", "current"]);
});
const quiz = () => getDocument("bus101-ch04-quiz-v1")!;

test("offline: the screen says so at once and everything local still works", async () => {
  await new Promise<void>((resolve) => {
    google.close(() => resolve());
    google.closeAllConnections();
  });
  const started = Date.now();
  const sync = await api(staff, "/api/drive/sync", "POST");
  assert.equal(sync.status, 503);
  assert.equal(sync.data.offline, true);
  assert.ok(Date.now() - started < 4000);

  const { data } = await api(staff, "/api/drive/status");
  assert.equal(data.online, false);
  assert.ok(data.lastSync);
  assert.equal(data.statusLine, "Everything downloaded - works offline");
  assert.equal(currentJob()!.phase, "done");

  const signIn = await call("/auth/google");
  assert.equal(signIn.headers.get("location"), "/signin?google=offline");
  assert.match(quiz().body, /pineapple ledger/);
  assert.ok(fs.existsSync(path.join(tmp, "mirror", "deskmate-demo-drive", "BUS101", "Chapter 4", "BUS101 Chapter 4 Quiz.md")));
});
