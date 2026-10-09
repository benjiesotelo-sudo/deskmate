import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db } from "./db.ts";
import { peopleFile } from "./office.ts";
import type { Person } from "./types.ts";

const COOKIE = "deskmate_session";
const SESSION_DAYS = 14;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

// Used by password sign-in here and by Google sign-in in the Google module.
export function startSession(res: Response, personId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 3600;
  db.prepare("INSERT INTO sessions (token, person_id, expires_at) VALUES (?, ?, ?)").run(token, personId, Date.now() + maxAge * 1000);
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}

export function endSession(req: Request, res: Response) {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export function currentPerson(req: Request): Person | undefined {
  const token = readCookie(req, COOKIE);
  if (!token) return undefined;
  const row = db.prepare("SELECT person_id, expires_at FROM sessions WHERE token = ?").get(token) as
    | { person_id: string; expires_at: number }
    | undefined;
  if (!row) return undefined;
  if (row.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return undefined;
  }
  return peopleFile().find((p) => p.id === row.person_id);
}

export function signIn(username: string, password: string): Person | undefined {
  const login = username.trim().toLowerCase();
  const person = peopleFile().find((p) => p.username === login || p.email.toLowerCase() === login);
  if (!person) return undefined;
  const row = db.prepare("SELECT password_hash FROM users WHERE person_id = ?").get(person.id) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return undefined;
  return person;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const person = currentPerson(req);
  if (!person) {
    res.status(401).json({ error: "Please sign in." });
    return;
  }
  res.locals.person = person;
  next();
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if ((res.locals.person as Person | undefined)?.access !== "admin") {
    res.status(403).json({ error: "Only an office admin can do this." });
    return;
  }
  next();
}
