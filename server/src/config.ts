import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Minimal KEY=VALUE reader so the app needs no dotenv dependency.
function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

// Real environment wins, then .env in the repo, then the Google file in the home folder.
const fileEnv = { ...readEnvFile(path.join(os.homedir(), ".deskmate-google.env")), ...readEnvFile(path.join(ROOT, ".env")) };
export function env(name: string): string | undefined {
  const value = process.env[name] ?? fileEnv[name];
  return value && value.trim() ? value.trim() : undefined;
}

export const PORT = Number(env("PORT") ?? 4747);
export const IS_PROD = process.env.NODE_ENV === "production";

export const SAMPLE_OFFICE_DIR = path.join(ROOT, "data", "sample-office");
// The working copy of the office. Seeded from the sample office, then edited by the app.
export const OFFICE_DIR = env("DESKMATE_OFFICE_DIR") ? path.resolve(env("DESKMATE_OFFICE_DIR")!) : path.join(ROOT, "data", "office");
const dbSetting = env("DESKMATE_DB");
export const DB_PATH = dbSetting === ":memory:" ? dbSetting : dbSetting ? path.resolve(dbSetting) : path.join(ROOT, "data", "deskmate.sqlite");
// Files pulled from the connected Google Drive folder. Never committed.
export const MIRROR_DIR = env("DESKMATE_MIRROR_DIR") ? path.resolve(env("DESKMATE_MIRROR_DIR")!) : path.join(ROOT, "data", "mirror");
export const WEB_DIST = path.join(ROOT, "web", "dist");

export const OLLAMA_HOST = (env("OLLAMA_HOST") ?? "http://127.0.0.1:11434").replace(/\/$/, "");
export const CHAT_MODEL = env("DESKMATE_CHAT_MODEL") ?? "qwen3:4b";
export const EMBED_MODEL = env("DESKMATE_EMBED_MODEL") ?? "nomic-embed-text";
export const CLOUD_MODEL = "claude-sonnet-5-5";

// Google endpoints. The overrides exist so the tests can stand in a local server for Google.
export const GOOGLE_AUTH_URL = env("DESKMATE_GOOGLE_AUTH_URL") ?? "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = env("DESKMATE_GOOGLE_TOKEN_URL") ?? "https://oauth2.googleapis.com/token";
export const GOOGLE_API_URL = (env("DESKMATE_GOOGLE_API_URL") ?? "https://www.googleapis.com").replace(/\/$/, "");
export const GOOGLE_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/drive"];
export const GOOGLE_REDIRECT_URI = env("GOOGLE_REDIRECT_URI") ?? `http://localhost:${PORT}/auth/google/callback`;

export const DEMO_PASSWORD = "deskmate";
