import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import { IS_PROD, PORT, ROOT, WEB_DIST } from "./config.ts";
import { googleRouter } from "./google.ts";
import { ensureOfficeCopy } from "./office.ts";
import { api } from "./routes.ts";
import { isSeeded, seed } from "./seed.ts";
import { completeEmbeddings, indexSummary, rebuildIndex } from "./tams/indexer.ts";
import { warmUp } from "./tams/ollama.ts";

ensureOfficeCopy();
if (!isSeeded()) {
  const { people, documents } = await seed();
  console.log(`First run: seeded the sample office (${people} people, ${documents} documents).`);
}

const app = express();
app.disable("x-powered-by");
const server = http.createServer(app);

app.use(googleRouter);
app.use(api);

if (IS_PROD) {
  if (!fs.existsSync(path.join(WEB_DIST, "index.html"))) {
    console.error("The web app is not built yet. Run: npm run build");
    process.exit(1);
  }
  app.use(express.static(WEB_DIST, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(WEB_DIST, "index.html"));
  });
} else {
  // In development the same port also serves the web app through Vite, with hot reload.
  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.join(ROOT, "web", "vite.config.ts"),
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

server.listen(PORT, () => {
  console.log(`Deskmate is running at http://localhost:${PORT}`);
  // Get Tams ready in the background: finish the index and load the chat model.
  void (async () => {
    try {
      if (indexSummary().chunks === 0) {
        const summary = await rebuildIndex();
        console.log(`Tams indexed ${summary.chunks} passages (${summary.embedded} with embeddings).`);
      } else {
        await completeEmbeddings();
      }
    } catch (error) {
      console.log(`Tams could not finish indexing: ${error instanceof Error ? error.message : error}`);
    }
    await warmUp();
  })();
});
