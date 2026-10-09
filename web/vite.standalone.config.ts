// STANDALONE SCAFFOLD - only used to run the office and process module on its own.
// deskmate-core owns the real web/vite.config.ts; delete this file at merge.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: `${here}standalone`,
  publicDir: `${here}public`,
  plugins: [react()],
  server: { port: 5183, fs: { allow: [here] } },
  build: { outDir: `${here}dist-standalone`, emptyOutDir: true },
});
