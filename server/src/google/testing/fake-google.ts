import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";

// A stand-in for Google that runs on this machine, used only by the tests: the
// consent redirect, the token endpoint and the parts of the Drive API the mirror uses.
// The real app code talks to it over HTTP, so sign-in, listing, export, download,
// sidecars and the offline path are all exercised without a Google account.

export type FakeFile = { id: string; name: string; mimeType: string; parents: string[]; modifiedTime: string; content?: Buffer; owner?: string };

const SAMPLE = path.resolve(import.meta.dirname, "..", "..", "..", "..", "data", "sample-office", "documents");
const docx = fs.readFileSync(path.join(SAMPLE, "FIN201", "chapter-01", "FIN201-ch01-materials-v1.docx"));
const FOLDER = "application/vnd.google-apps.folder";
export const files = new Map<string, FakeFile>();
let clock = Date.parse("2026-10-09T08:00:00Z");
export const tick = () => new Date((clock += 1000)).toISOString();
let nextId = 100;

function put(file: Omit<FakeFile, "modifiedTime">) {
  files.set(file.id, { ...file, modifiedTime: tick() });
}

put({ id: "root-folder-1", name: "Deskmate Demo Drive", mimeType: FOLDER, parents: ["root"] });
put({ id: "f-bus", name: "BUS101", mimeType: FOLDER, parents: ["root-folder-1"] });
put({ id: "f-bus-4", name: "Chapter 4", mimeType: FOLDER, parents: ["f-bus"] });
put({ id: "f-bus-1", name: "Chapter 1", mimeType: FOLDER, parents: ["f-bus"] });
put({ id: "f-admin", name: "Admin", mimeType: FOLDER, parents: ["root-folder-1"] });
put({ id: "quiz-4", name: "BUS101 Chapter 4 Quiz.md", mimeType: "text/markdown", parents: ["f-bus-4"], content: Buffer.from("# Chapter 4 quiz\n\nThe pineapple ledger question is worth five points.\n") });
put({ id: "deck-1", name: "Chapter 1 slides.md", mimeType: "text/markdown", parents: ["f-bus-1"], content: Buffer.from("# Slides from Drive\n") });
put({ id: "gdoc-1", name: "Reading notes", mimeType: "application/vnd.google-apps.document", parents: ["f-bus-4"], owner: "rafael@deskmate.example" });
put({ id: "photo-1", name: "Office floor plan.png", mimeType: "image/png", parents: ["f-admin"], content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) });
put({ id: "form-1", name: "Leave form", mimeType: "application/vnd.google-apps.form", parents: ["f-admin"] });

const describe = (f: FakeFile) => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  modifiedTime: f.modifiedTime,
  parents: f.parents,
  size: f.content ? String(f.content.length) : undefined,
  owners: [{ emailAddress: f.owner ?? "captain@example.com" }],
  webViewLink: `https://drive.example/${f.id}`,
});

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", () => resolve(Buffer.concat(parts)));
  });
}

const idToken = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;

export const google = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://fake");
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/generate_204") return void res.writeHead(204).end();
  // The consent screen: approve at once and send the browser back, as Google does after "Allow".
  if (url.pathname === "/auth") {
    const back = new URL(url.searchParams.get("redirect_uri")!);
    back.searchParams.set("code", `code-${process.env.FAKE_GOOGLE_EMAIL ?? "captain@example.com"}`);
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    return void res.writeHead(302, { Location: back.toString() }).end();
  }
  if (url.pathname === "/token") {
    const form = new URLSearchParams((await readBody(req)).toString());
    if (form.get("client_secret") !== "test-secret") return send(401, { error: "invalid_client" });
    if (form.get("grant_type") === "authorization_code") {
      const email = form.get("code")!.replace(/^code-/, "");
      return send(200, {
        access_token: `at-${email}`,
        expires_in: 3600,
        refresh_token: `rt-${email}`,
        scope: "openid email profile https://www.googleapis.com/auth/drive",
        id_token: idToken({ iss: "https://accounts.google.com", aud: "test-client", sub: `sub-${email}`, email, email_verified: true, name: "Test Person" }),
      });
    }
    return send(200, { access_token: `at-refreshed-${Date.now()}`, expires_in: 3600 });
  }
  if (!/^Bearer at-/.test(req.headers.authorization ?? "")) return send(401, { error: { message: "Invalid Credentials", errors: [{ reason: "authError" }] } });

  const upload = /^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/.exec(url.pathname);
  if (upload) {
    const body = (await readBody(req)).toString();
    if (req.method === "PATCH") {
      const file = files.get(upload[1]);
      if (!file) return send(404, { error: { message: "File not found" } });
      file.content = Buffer.from(body);
      file.modifiedTime = tick();
      return send(200, { id: file.id, modifiedTime: file.modifiedTime });
    }
    const [, metaPart, contentPart] = body.split(/--deskmate-[a-z0-9]+/);
    const meta = JSON.parse(metaPart.split("\r\n\r\n")[1]) as { name: string; parents: string[]; mimeType: string };
    const id = `new-${nextId++}`;
    put({ id, ...meta, content: Buffer.from(contentPart.split("\r\n\r\n")[1].trim()) });
    return send(200, { id, modifiedTime: files.get(id)!.modifiedTime });
  }

  if (url.pathname === "/drive/v3/files") {
    const parent = /'([^']+)' in parents/.exec(url.searchParams.get("q") ?? "")?.[1];
    return send(200, { files: [...files.values()].filter((f) => f.parents.includes(parent ?? "")).map(describe) });
  }
  const one = /^\/drive\/v3\/files\/([^/]+)(\/export)?$/.exec(url.pathname);
  const file = one && files.get(one[1]);
  if (!file) return send(404, { error: { message: "File not found" } });
  if (one[2]) {
    res.writeHead(200, { "Content-Type": url.searchParams.get("mimeType")! });
    return void res.end(docx);
  }
  if (url.searchParams.get("alt") === "media") {
    res.writeHead(200, { "Content-Type": file.mimeType });
    return void res.end(file.content ?? Buffer.alloc(0));
  }
  send(200, describe(file));
});

await new Promise<void>((resolve) => google.listen(Number(process.env.FAKE_GOOGLE_PORT ?? 0), "127.0.0.1", resolve));
export const googleUrl = `http://127.0.0.1:${(google.address() as AddressInfo).port}`;

// What the app needs in its environment to talk to this stand-in instead of Google.
export const googleEnv = {
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  DESKMATE_GOOGLE_AUTH_URL: `${googleUrl}/auth`,
  DESKMATE_GOOGLE_TOKEN_URL: `${googleUrl}/token`,
  DESKMATE_GOOGLE_API_URL: googleUrl,
};

