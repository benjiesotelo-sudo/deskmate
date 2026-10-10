import fs from "node:fs";
import path from "node:path";
import { DEMO_PASSWORD, OFFICE_DIR } from "./config.ts";
import { hashPassword } from "./auth.ts";
import { db } from "./db.ts";
import { insertDocument, listDocuments } from "./documents.ts";
import { extractText } from "./extract.ts";
import { ensureOfficeCopy, officePath, peopleFile } from "./office.ts";
import type { DocRecord } from "./types.ts";

export function isSeeded(): boolean {
  const row = db.prepare("SELECT COUNT(*) AS n FROM documents").get() as { n: number };
  return Number(row.n) > 0;
}

// Load the office folder into the database: accounts and document records with their text.
export async function seed(options: { reset?: boolean } = {}): Promise<{ people: number; documents: number }> {
  ensureOfficeCopy(options.reset);
  if (options.reset) db.exec("DELETE FROM chunks; DELETE FROM documents; DELETE FROM sessions; DELETE FROM users;");

  const people = peopleFile();
  const addUser = db.prepare("INSERT OR IGNORE INTO users (person_id, username, password_hash) VALUES (?, ?, ?)");
  for (const person of people) addUser.run(person.id, person.username, hashPassword(DEMO_PASSWORD));

  const records = JSON.parse(fs.readFileSync(path.join(OFFICE_DIR, "documents.json"), "utf8")) as DocRecord[];
  for (const record of records) {
    const file = officePath(record.path);
    const body = fs.existsSync(file) ? await extractText(file) : "";
    insertDocument(record, body);
  }
  return { people: people.length, documents: records.length };
}

// Keep documents.json in the office folder in step with the database, so the
// folder alone is always a complete, portable copy of the office.
export function writeDocumentsFile() {
  fs.writeFileSync(path.join(OFFICE_DIR, "documents.json"), JSON.stringify(listDocuments(), null, 2) + "\n");
}
