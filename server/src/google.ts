import express, { Router, type Request, type Response } from "express";
import { currentPerson, requireAuth, startSession } from "./auth.ts";
import { GOOGLE_REDIRECT_URI } from "./config.ts";
import { listFolders } from "./google/drive.ts";
import { connect, disconnect, getConnection, isRunning, start, summary, tree } from "./google/mirror.ts";
import {
  accountBySub,
  accountForPerson,
  beginSignIn,
  finishSignIn,
  googleConfig,
  GoogleError,
  googleOnline,
  OfflineError,
  personForGoogle,
  saveAccount,
  takePending,
} from "./google/oauth.ts";
import { peopleFile } from "./office.ts";
import type { Person } from "./types.ts";

// Google sign-in and the Drive mirror.
// Sign-in is the OAuth code flow; Google confirms who the person is and startSession()
// from auth.ts does the rest, exactly as for a username and password.
// The mirror lives in ./google/mirror.ts and is driven from the routes at the bottom.

export { googleConfig };
export const googleRouter = Router();
const json = express.json({ limit: "100kb" });

const STATE_COOKIE = "deskmate_oauth";
const setStateCookie = (res: Response, value: string, maxAge: number) =>
  res.append("Set-Cookie", `${STATE_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/auth/google; Max-Age=${maxAge}`);

function readStateCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === STATE_COOKIE) return part.slice(eq + 1).trim();
  }
  return undefined;
}

const NOT_CONFIGURED = "Google sign-in is not configured on this machine. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment or in ~/.deskmate-google.env.";

googleRouter.get("/auth/google/status", async (req, res) => {
  const { configured } = googleConfig();
  const online = configured ? await googleOnline() : false;
  const person = currentPerson(req);
  const account = person ? accountForPerson(person.id) : undefined;
  res.json({
    configured,
    ready: configured,
    online,
    message: !configured
      ? NOT_CONFIGURED
      : online
        ? "Google sign-in is switched on."
        : "Google sign-in is switched on, but Google cannot be reached right now. Username and password still work.",
    account: account ? { email: account.email, name: account.name, driveGranted: account.driveGranted, connected: account.hasRefreshToken } : null,
  });
});

// Where to send the browser when Google sign-in cannot go ahead.
function bounce(req: Request, res: Response, reason: string, linking: boolean) {
  if (req.accepts(["html", "json"]) !== "html") {
    res.status(reason === "not-configured" ? 501 : 503).json({ error: reason === "not-configured" ? NOT_CONFIGURED : "Google cannot be reached right now. Use a username and password." });
    return;
  }
  res.redirect(`${linking ? "/settings" : "/signin"}?google=${reason}`);
}

googleRouter.get("/auth/google", async (req, res) => {
  const linking = req.query.link === "1";
  if (!googleConfig().configured) return bounce(req, res, "not-configured", linking);

  // Google sends the browser back to one fixed address, so the round trip has to start from that same host.
  const home = new URL(GOOGLE_REDIRECT_URI);
  if (req.headers.host && req.headers.host !== home.host) {
    res.redirect(`${home.origin}${req.originalUrl}`);
    return;
  }
  // Offline: say so on the sign-in page instead of leaving the browser on a page that never loads.
  if (!(await googleOnline(0))) return bounce(req, res, "offline", linking);

  const person = linking ? currentPerson(req) : undefined;
  if (linking && !person) {
    res.redirect("/signin");
    return;
  }
  const { state, url } = beginSignIn({ linkPersonId: person?.id ?? null, consent: req.query.consent === "1" });
  setStateCookie(res, state, 600);
  res.redirect(url);
});

googleRouter.get("/auth/google/callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const cookie = readStateCookie(req);
  setStateCookie(res, "", 0);
  const waiting = state && cookie === state ? takePending(state) : undefined;
  const linking = Boolean(waiting?.linkPersonId);
  const back = (reason: string) => res.redirect(`${linking ? "/settings" : "/signin"}?google=${reason}`);

  if (typeof req.query.error === "string") return void back(req.query.error === "access_denied" ? "denied" : "failed");
  if (!waiting || !code) return void back("expired");

  try {
    const { profile, scope, refreshToken } = await finishSignIn(code, waiting.verifier);
    const { person } = personForGoogle(profile, waiting.linkPersonId);
    saveAccount(profile, person.id, scope, refreshToken);
    // No refresh token on file means the mirror could not run later. Google gives one on the consent screen.
    if (!accountBySub(profile.sub)?.hasRefreshToken && !waiting.consent) {
      res.redirect(`/auth/google?consent=1${linking ? "&link=1" : ""}`);
      return;
    }
    if (!linking) startSession(res, person.id);
    res.redirect(linking ? "/settings?google=connected" : "/");
  } catch (error) {
    if (error instanceof OfflineError) return void back("offline");
    // The reason is safe to log. Codes and tokens are never logged.
    console.log(`Google sign-in did not complete: ${error instanceof Error ? error.message : "unknown error"}`);
    back("failed");
  }
});

// ---------- the Drive mirror ----------

googleRouter.use("/api/drive", requireAuth);

const me = (res: Response) => res.locals.person as Person;

// Google errors are never passed on as 401: to the web app a 401 means "signed out of Deskmate".
function fail(res: Response, error: unknown) {
  if (error instanceof OfflineError) {
    res.status(503).json({ error: "Google Drive cannot be reached. This machine looks offline.", offline: true });
    return;
  }
  if (error instanceof GoogleError) {
    res.status(error.status >= 500 ? 502 : 400).json({ error: error.message });
    return;
  }
  console.log(`Drive mirror error: ${error instanceof Error ? error.message : "unknown error"}`);
  res.status(500).json({ error: "The Drive mirror hit an unexpected problem. Try again." });
}

async function driveStatus(person: Person) {
  const { configured } = googleConfig();
  const state = summary();
  const account = accountForPerson(person.id);
  const conn = state.connection;
  return {
    configured,
    // Not checked at all on a machine with no Google credentials, so the screen answers at once there.
    online: configured ? await googleOnline() : false,
    account: account ? { email: account.email, name: account.name, driveGranted: account.driveGranted, connected: account.hasRefreshToken } : null,
    connection: conn
      ? {
          folderId: conn.folderId,
          folderName: conn.folderName,
          link: conn.link,
          accountEmail: conn.accountEmail,
          connectedBy: peopleFile().find((p) => p.id === conn.connectedBy)?.name ?? conn.connectedBy,
          connectedAt: conn.connectedAt,
          mirrorFolder: state.mirrorFolder,
        }
      : null,
    canManage: Boolean(conn) && (person.access === "admin" || conn?.connectedBy === person.id),
    counts: state.counts,
    statusLine: state.statusLine,
    lastSync: state.lastSync,
    lastListed: state.lastListed,
    job: state.job,
  };
}

googleRouter.get("/api/drive/status", async (_req, res) => {
  res.json(await driveStatus(me(res)));
});

googleRouter.get("/api/drive/tree", (_req, res) => {
  res.json(getConnection() ? tree() : []);
});

function driveAccount(res: Response) {
  const account = accountForPerson(me(res).id);
  if (!account?.hasRefreshToken) throw new GoogleError(400, "Connect your Google account first.");
  if (!account.driveGranted) throw new GoogleError(400, "Deskmate was not given access to Google Drive. Connect Google again and tick the Drive box.");
  return account;
}

googleRouter.get("/api/drive/folders", async (req, res) => {
  try {
    const account = driveAccount(res);
    const q = req.query as Record<string, string | undefined>;
    const folders = await listFolders(account.sub, { parent: q.parent || undefined, search: q.search?.trim() || undefined, shared: q.shared === "1" });
    res.json(folders.map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime ?? null, link: f.webViewLink ?? null })));
  } catch (error) {
    fail(res, error);
  }
});

googleRouter.post("/api/drive/connect", json, async (req, res) => {
  try {
    if (isRunning()) throw new GoogleError(400, "A sync is running. Wait for it to finish.");
    const folder = (req.body as { folder?: unknown } | undefined)?.folder;
    if (typeof folder !== "string" || !folder.trim()) throw new GoogleError(400, "Paste a Drive folder link or ID, or pick a folder.");
    await connect(me(res), driveAccount(res), folder);
    res.json(await driveStatus(me(res)));
  } catch (error) {
    fail(res, error);
  }
});

function startJob(kind: "sync" | "download") {
  return async (_req: Request, res: Response) => {
    try {
      if (!getConnection()) throw new GoogleError(400, "Connect a Drive folder first.");
      // Fail at once when offline, so the button never spins on a dead network.
      if (!(await googleOnline(0))) throw new OfflineError();
      start(kind, me(res));
      res.status(202).json(await driveStatus(me(res)));
    } catch (error) {
      fail(res, error);
    }
  };
}
googleRouter.post("/api/drive/sync", startJob("sync"));
googleRouter.post("/api/drive/download", startJob("download"));

googleRouter.post("/api/drive/disconnect", async (_req, res) => {
  const person = me(res);
  const conn = getConnection();
  if (conn && person.access !== "admin" && conn.connectedBy !== person.id) {
    res.status(403).json({ error: "Only an office admin or the person who connected the folder can disconnect it." });
    return;
  }
  if (isRunning()) {
    res.status(400).json({ error: "A sync is running. Wait for it to finish." });
    return;
  }
  disconnect();
  res.json(await driveStatus(person));
});
