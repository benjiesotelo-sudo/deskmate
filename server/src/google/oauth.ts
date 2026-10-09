import crypto from "node:crypto";
import { env, GOOGLE_API_URL, GOOGLE_AUTH_URL, GOOGLE_REDIRECT_URI, GOOGLE_SCOPES, GOOGLE_TOKEN_URL } from "../config.ts";
import { db } from "../db.ts";
import { slugify } from "../filing.ts";
import { peopleFile, savePeople } from "../office.ts";
import type { Person } from "../types.ts";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

// The network is down, or Google could not be reached in time.
export class OfflineError extends Error {
  constructor(message = "Google cannot be reached. This machine looks offline.") {
    super(message);
  }
}

// Google answered, and the answer was no.
export class GoogleError extends Error {
  status: number;
  reason: string;
  constructor(status: number, message: string, reason = "") {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

export function googleConfig() {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

// Every call to Google goes through here, so a dead network always becomes an
// OfflineError within the timeout and never a request that hangs.
export async function googleFetch(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    lastProbe = { at: Date.now(), online: true };
    return res;
  } catch {
    lastProbe = { at: Date.now(), online: false };
    throw new OfflineError();
  }
}

let lastProbe = { at: 0, online: false };

// A quick answer to "is Google reachable right now?", remembered for a few seconds.
export async function googleOnline(maxAgeMs = 8_000): Promise<boolean> {
  if (Date.now() - lastProbe.at < maxAgeMs) return lastProbe.online;
  try {
    // Any HTTP answer means the network path is there.
    await googleFetch(`${GOOGLE_API_URL}/generate_204`, { method: "HEAD" }, 2500);
  } catch {
    // googleFetch already recorded the result.
  }
  return lastProbe.online;
}

// ---------- the sign-in round trip ----------

type Pending = { verifier: string; linkPersonId: string | null; consent: boolean; createdAt: number };
const pending = new Map<string, Pending>();
const PENDING_MS = 10 * 60 * 1000;

export function beginSignIn(options: { linkPersonId: string | null; consent: boolean }): { state: string; url: string } {
  for (const [key, value] of pending) if (Date.now() - value.createdAt > PENDING_MS) pending.delete(key);
  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  pending.set(state, { verifier, linkPersonId: options.linkPersonId, consent: options.consent, createdAt: Date.now() });
  const params = new URLSearchParams({
    client_id: googleConfig().clientId ?? "",
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state,
    access_type: "offline",
    include_granted_scopes: "true",
    code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    // Google hands out a refresh token only on the consent screen, so ask for it when one is needed.
    prompt: options.consent ? "consent" : "select_account",
  });
  return { state, url: `${GOOGLE_AUTH_URL}?${params}` };
}

export function takePending(state: string): Pending | undefined {
  const found = pending.get(state);
  pending.delete(state);
  if (!found || Date.now() - found.createdAt > PENDING_MS) return undefined;
  return found;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; id_token?: string; scope?: string };

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleConfig();
  const res = await googleFetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId ?? "", client_secret: clientSecret ?? "", ...form }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new GoogleError(res.status, data.error_description ?? data.error ?? "Google refused the request.", data.error ?? "");
  }
  return data;
}

export type GoogleProfile = { sub: string; email: string; name: string };

// The ID token comes straight from Google's token endpoint over TLS, so its
// claims are read here and checked for audience, issuer and a verified email.
function readIdToken(idToken: string | undefined): GoogleProfile {
  const payload = idToken?.split(".")[1];
  if (!payload) throw new GoogleError(400, "Google did not say who signed in.");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    aud?: string;
    iss?: string;
  };
  if (claims.aud !== googleConfig().clientId) throw new GoogleError(400, "That Google sign-in was meant for a different app.");
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new GoogleError(400, "That sign-in did not come from Google.");
  if (!claims.sub || !claims.email) throw new GoogleError(400, "Google did not share an email address.");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw new GoogleError(400, "That Google email address is not verified.");
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name?.trim() || claims.email.split("@")[0] };
}

export async function finishSignIn(code: string, verifier: string): Promise<{ profile: GoogleProfile; scope: string; refreshToken: string | null }> {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: GOOGLE_REDIRECT_URI });
  const profile = readIdToken(tokens.id_token);
  accessTokens.set(profile.sub, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 });
  return { profile, scope: tokens.scope ?? "", refreshToken: tokens.refresh_token ?? null };
}

// ---------- accounts ----------

export type GoogleAccount = { sub: string; personId: string; email: string; name: string; hasRefreshToken: boolean; driveGranted: boolean };

type AccountRow = { sub: string; person_id: string; email: string; name: string; refresh_token: string | null; scope: string };

const toAccount = (r: AccountRow): GoogleAccount => ({
  sub: r.sub,
  personId: r.person_id,
  email: r.email,
  name: r.name,
  hasRefreshToken: Boolean(r.refresh_token),
  driveGranted: r.scope.split(/\s+/).includes(DRIVE_SCOPE),
});

export function accountBySub(sub: string): GoogleAccount | undefined {
  const row = db.prepare("SELECT sub, person_id, email, name, refresh_token, scope FROM google_accounts WHERE sub = ?").get(sub) as AccountRow | undefined;
  return row ? toAccount(row) : undefined;
}

export function accountForPerson(personId: string): GoogleAccount | undefined {
  const row = db
    .prepare("SELECT sub, person_id, email, name, refresh_token, scope FROM google_accounts WHERE person_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(personId) as AccountRow | undefined;
  return row ? toAccount(row) : undefined;
}

// Keeps the refresh token Google gave earlier when a later sign-in does not send a new one.
export function saveAccount(profile: GoogleProfile, personId: string, scope: string, refreshToken: string | null) {
  db.prepare(
    `INSERT INTO google_accounts (sub, person_id, email, name, refresh_token, scope, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sub) DO UPDATE SET person_id = excluded.person_id, email = excluded.email, name = excluded.name,
       refresh_token = COALESCE(excluded.refresh_token, google_accounts.refresh_token),
       scope = CASE WHEN excluded.scope = '' THEN google_accounts.scope ELSE excluded.scope END,
       updated_at = excluded.updated_at`,
  ).run(profile.sub, personId, profile.email, profile.name, refreshToken, scope, new Date().toISOString());
}

const SKIN = ["#C68E6A", "#A9714B", "#E0AC7E", "#8D5A3B"];
const HAIR = ["#2B1D16", "#3A2A20", "#5A3A22", "#1B1B1B"];
const OUTFIT = ["#1F7A54", "#272B66", "#9A6200", "#C2371F", "#5B544A"];
const ACCESSORY = ["none", "glasses", "lanyard", "mug", "headset", "notebook"];

// A Google account nobody in the office uses yet becomes a new staff account,
// with the first free desk on the floor.
function addStaff(profile: GoogleProfile): Person {
  const people = peopleFile();
  const base = slugify(profile.email.split("@")[0]).slice(0, 24) || "staff";
  let id = base;
  for (let n = 2; people.some((p) => p.id === id || p.username === id); n++) id = `${base}-${n}`;
  const pick = <T>(list: T[], salt: number) => list[(crypto.createHash("sha1").update(profile.email).digest()[salt] ?? 0) % list.length];
  const far = (x: number, y: number, gap: number) => people.every((p) => Math.max(Math.abs(p.desk.x - x), Math.abs(p.desk.y - y)) >= gap);
  let desk = { x: 10, y: 6 };
  search: for (const gap of [3, 2, 1]) {
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 10; x++) {
        if (far(x, y, gap)) {
          desk = { x, y };
          break search;
        }
      }
    }
  }
  const person: Person = {
    id,
    username: id,
    name: profile.name,
    role: "Staff",
    access: "staff",
    email: profile.email,
    location: "office",
    desk,
    avatar: { skin: pick(SKIN, 0), hair: pick(HAIR, 1), outfit: pick(OUTFIT, 2), accessory: pick(ACCESSORY, 3) },
    owns: { documents: [], processes: [] },
  };
  savePeople([...people, person]);
  return person;
}

// Who a Google account is in this office: a link made earlier, then a matching
// email address, then a new staff account.
export function personForGoogle(profile: GoogleProfile, linkPersonId: string | null): { person: Person; created: boolean } {
  const people = peopleFile();
  if (linkPersonId) {
    const linked = people.find((p) => p.id === linkPersonId);
    if (linked) return { person: linked, created: false };
  }
  const known = accountBySub(profile.sub);
  const byLink = known && people.find((p) => p.id === known.personId);
  if (byLink) return { person: byLink, created: false };
  const byEmail = people.find((p) => p.email.toLowerCase() === profile.email);
  if (byEmail) return { person: byEmail, created: false };
  return { person: addStaff(profile), created: true };
}

// ---------- access tokens ----------

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

export function forgetAccessToken(sub: string) {
  accessTokens.delete(sub);
}

// A short-lived access token for a stored account. Tokens live in memory and in
// SQLite only. They are never logged and never sent to the browser.
export async function accessTokenFor(sub: string): Promise<string> {
  const cached = accessTokens.get(sub);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const row = db.prepare("SELECT refresh_token FROM google_accounts WHERE sub = ?").get(sub) as { refresh_token: string | null } | undefined;
  if (!row?.refresh_token) throw new GoogleError(401, "Google access has not been granted on this machine yet. Sign in with Google again.", "no_refresh_token");
  try {
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refresh_token });
    accessTokens.set(sub, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 });
    return tokens.access_token;
  } catch (error) {
    if (error instanceof GoogleError && error.reason === "invalid_grant") {
      db.prepare("UPDATE google_accounts SET refresh_token = NULL WHERE sub = ?").run(sub);
      throw new GoogleError(401, "Google access has expired or was withdrawn. Sign in with Google again to reconnect.", "invalid_grant");
    }
    throw error;
  }
}
