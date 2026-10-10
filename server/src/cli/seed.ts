import { seed } from "../seed.ts";
import { rebuildIndex } from "../tams/indexer.ts";
import { ollamaState } from "../tams/ollama.ts";

const reset = process.argv.includes("--reset");
const { people, documents } = await seed({ reset });
console.log(`Seeded ${people} people and ${documents} documents${reset ? " (fresh copy of the sample office)" : ""}.`);

const state = await ollamaState();
const summary = await rebuildIndex();
console.log(`Indexed ${summary.documents} documents and ${summary.processes} processes into ${summary.chunks} passages.`);
if (!state.embedReady) {
  console.log("Ollama or the embedding model was not available, so passages have no embeddings yet.");
  console.log("Tams falls back to keyword search until you run: npm run index");
} else {
  console.log(`Embedded ${summary.embedded} passages on this machine.`);
}
