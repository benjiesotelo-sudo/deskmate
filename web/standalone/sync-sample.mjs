// STANDALONE SCAFFOLD - copies the sample office JSON into web/public/sample so the
// module's API fallback can fetch it. data/sample-office/ stays the source of truth.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const from = fileURLToPath(new URL("../../data/sample-office/", import.meta.url));
const to = fileURLToPath(new URL("../public/sample/", import.meta.url));
mkdirSync(to, { recursive: true });
for (const name of ["people.json", "processes.json"]) {
  copyFileSync(from + name, to + name);
  console.log(`synced ${name}`);
}
