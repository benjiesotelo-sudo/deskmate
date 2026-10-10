import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GOOGLE_API_URL } from "../config.ts";
import { accessTokenFor, forgetAccessToken, GoogleError, googleFetch, OfflineError } from "./oauth.ts";
import { exportFor, FOLDER_TYPE } from "./infer.ts";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  owners?: { emailAddress?: string }[];
  webViewLink?: string;
};

const ITEM_FIELDS = "id,name,mimeType,modifiedTime,size,parents,owners(emailAddress),webViewLink";
const ALL_DRIVES = { supportsAllDrives: "true", includeItemsFromAllDrives: "true" };

function plainReason(status: number, message: string, reason: string): string {
  if (reason === "accessNotConfigured") return "The Google Drive API is not enabled for this Google Cloud project. Enable it in the Cloud console, then try again.";
  if (status === 404) return "Google Drive has no such file or folder for this account.";
  if (reason === "insufficientPermissions" || reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
    return "Deskmate was not given access to Google Drive. Sign in with Google again and tick the Drive box.";
  }
  if (status === 403 && /rate|quota/i.test(reason + message)) return "Google Drive is rate limiting this account. Wait a minute and try again.";
  return message || `Google Drive returned an error (${status}).`;
}

// One authorised call to the Drive API for the given Google account.
// A rejected token is refreshed once before giving up.
async function call(sub: string, url: string, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = await accessTokenFor(sub);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const res = await googleFetch(url, { ...init, headers }, timeoutMs);
    if (res.status === 401 && attempt === 0) {
      forgetAccessToken(sub);
      continue;
    }
    if (res.ok) return res;
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string; errors?: { reason?: string }[] } } | null;
    const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "";
    throw new GoogleError(res.status, plainReason(res.status, body?.error?.message ?? "", reason), reason);
  }
}

const q = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function getItem(sub: string, id: string): Promise<DriveItem> {
  const params = new URLSearchParams({ fields: ITEM_FIELDS, supportsAllDrives: "true" });
  const res = await call(sub, `${GOOGLE_API_URL}/drive/v3/files/${encodeURIComponent(id)}?${params}`);
  return (await res.json()) as DriveItem;
}

async function listAll(sub: string, query: string, orderBy?: string, limit = Infinity): Promise<DriveItem[]> {
  const out: DriveItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, fields: `nextPageToken,files(${ITEM_FIELDS})`, pageSize: "1000", ...ALL_DRIVES });
    if (orderBy) params.set("orderBy", orderBy);
    if (pageToken) params.set("pageToken", pageToken);
    const res = await call(sub, `${GOOGLE_API_URL}/drive/v3/files?${params}`);
    const page = (await res.json()) as { files?: DriveItem[]; nextPageToken?: string };
    out.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && out.length < limit);
  return out;
}

export const listChildren = (sub: string, folderId: string) => listAll(sub, `'${q(folderId)}' in parents and trashed = false`, "folder,name");

// Folders to choose from when connecting: inside one folder, shared with this account, or by name.
export function listFolders(sub: string, options: { parent?: string; search?: string; shared?: boolean }): Promise<DriveItem[]> {
  const clauses = [`mimeType = '${FOLDER_TYPE}'`, "trashed = false"];
  if (options.search) clauses.push(`name contains '${q(options.search)}'`);
  else if (options.shared) clauses.push("sharedWithMe = true");
  else clauses.push(`'${q(options.parent || "root")}' in parents`);
  return listAll(sub, clauses.join(" and "), options.search ? undefined : "name", 200);
}

// Bring one file down to disk. Google's own formats are exported; everything else comes as it is.
// The bytes land in a ".part" file first, so a dropped connection never leaves half a document in the mirror.
export async function download(sub: string, item: { id: string; mime: string }, target: string, onBytes: (n: number) => void): Promise<void> {
  const exported = exportFor(item.mime);
  const url = exported
    ? `${GOOGLE_API_URL}/drive/v3/files/${encodeURIComponent(item.id)}/export?${new URLSearchParams({ mimeType: exported.mime })}`
    : `${GOOGLE_API_URL}/drive/v3/files/${encodeURIComponent(item.id)}?${new URLSearchParams({ alt: "media", supportsAllDrives: "true" })}`;
  const res = await call(sub, url, {}, 10 * 60 * 1000);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const part = `${target}.part`;
  try {
    if (!res.body) fs.writeFileSync(part, "");
    else {
      const body = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream<Uint8Array>);
      body.on("data", (chunk: Buffer) => onBytes(chunk.length));
      await pipeline(body, fs.createWriteStream(part));
    }
    fs.renameSync(part, target);
  } catch (error) {
    fs.rmSync(part, { force: true });
    if (error instanceof GoogleError) throw error;
    throw new OfflineError("The connection to Google Drive dropped during a download.");
  }
}

export async function readJson(sub: string, id: string): Promise<unknown> {
  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  const res = await call(sub, `${GOOGLE_API_URL}/drive/v3/files/${encodeURIComponent(id)}?${params}`);
  return res.json().catch(() => null);
}

// Create or replace a small JSON file in a Drive folder. Returns its id and modified time.
export async function writeJson(sub: string, options: { id?: string | null; name: string; parentId: string; content: unknown }): Promise<{ id: string; modifiedTime: string }> {
  const text = JSON.stringify(options.content, null, 2) + "\n";
  const fields = new URLSearchParams({ fields: "id,modifiedTime", supportsAllDrives: "true" });
  if (options.id) {
    try {
      const res = await call(sub, `${GOOGLE_API_URL}/upload/drive/v3/files/${encodeURIComponent(options.id)}?uploadType=media&${fields}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      return (await res.json()) as { id: string; modifiedTime: string };
    } catch (error) {
      // The sidecar was deleted in Drive: fall through and make a new one.
      if (!(error instanceof GoogleError) || error.status !== 404) throw error;
    }
  }
  const boundary = `deskmate-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name: options.name, parents: [options.parentId], mimeType: "application/json" });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  const res = await call(sub, `${GOOGLE_API_URL}/upload/drive/v3/files?uploadType=multipart&${fields}`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()) as { id: string; modifiedTime: string };
}
