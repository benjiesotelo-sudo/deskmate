import { isSeeded, seed } from "../seed.ts";
import { rebuildIndex } from "../tams/indexer.ts";
import { ollamaState } from "../tams/ollama.ts";

if (!isSeeded()) await seed();
const state = await ollamaState();
if (!state.reachable) console.log("Ollama is not running. Building a keyword-only index. Start Ollama and run this again for embeddings.");
else if (!state.embedReady) console.log("The embedding model is missing. Run scripts/setup.sh, then run this again.");

const started = Date.now();
const summary = await rebuildIndex();
console.log(
  `Indexed ${summary.documents} documents and ${summary.processes} processes: ${summary.chunks} passages, ${summary.embedded} embedded, in ${((Date.now() - started) / 1000).toFixed(1)}s.`,
);
