import { CHAT_MODEL, CLOUD_MODEL } from "../config.ts";
import { getDocument } from "../documents.ts";
import { office, peopleFile, processes } from "../office.ts";
import { cloudErrorMessage, cloudStatus, cloudStream } from "./cloud.ts";
import { chatStream, ollamaState, type ChatMessage } from "./ollama.ts";
import { retrieve, type Passage } from "./retrieve.ts";

export type Turn = { role: "user" | "assistant"; content: string };
export type Mode = "local" | "cloud";

export type FinalFrame = {
  sources: { docId: string; title: string; n: number }[];
  processes: { processId: string; title: string; n: number }[];
  processId?: string;
  mode: Mode;
  model: string;
  retrieval: "embeddings" | "keywords" | "none";
  notice?: string;
};

type NumberedSource = { n: number; type: "document" | "process"; id: string; title: string; text: string; label: string };

function numberSources(passages: Passage[]): NumberedSource[] {
  const sources: NumberedSource[] = [];
  for (const p of passages) {
    let entry = sources.find((s) => s.type === p.sourceType && s.id === p.sourceId);
    if (!entry) {
      let label = `Process: ${p.title}`;
      if (p.sourceType === "document") {
        const doc = getDocument(p.sourceId);
        label = `Document: ${p.title}${doc ? ` (${doc.kind}, ${doc.course}${doc.chapter ? `, Chapter ${doc.chapter}` : ""}, version ${doc.version}, ${doc.status})` : ""}`;
      }
      entry = { n: sources.length + 1, type: p.sourceType, id: p.sourceId, title: p.title, text: "", label };
      sources.push(entry);
    }
    entry.text += (entry.text ? "\n\n" : "") + p.text;
  }
  return sources;
}

function systemPrompt(): string {
  const o = office();
  const admin = peopleFile().find((p) => p.access === "admin");
  return [
    `You are Tams, the friendly bull who is the office assistant of the ${o.name}.`,
    "You help staff, especially new hires, find documents and follow the office's documented processes.",
    "Rules:",
    "- Answer ONLY from the numbered office excerpts in the user's message. Do not use outside knowledge.",
    "- Cite the excerpt a fact came from in square brackets, like [1]. One citation at the end of a sentence or a list is enough.",
    "- When the excerpts describe a process, list every step in order as a numbered list. Each step is one line: what to do, who does it, and the one detail that matters most.",
    "- End a process answer with the office's own real example in one sentence, when the excerpts give one.",
    `- If the excerpts do not answer the question, say plainly that you could not find it in the office's documents, and suggest asking ${admin?.name ?? "the office administrator"}. Do not guess.`,
    "- Keep it short and warm. Use plain dashes, never long dashes. No preamble.",
  ].join("\n");
}

function userPrompt(question: string, sources: NumberedSource[]): string {
  if (!sources.length) {
    return [
      "No office excerpts matched this message.",
      "If it is a greeting or a question about what you can do, answer in one or two sentences as Tams.",
      "Otherwise say you could not find it in the office's documents. Do not answer from outside knowledge.",
      "",
      `Message: ${question}`,
    ].join("\n");
  }
  const excerpts = sources.map((s) => `[${s.n}] ${s.label}\n${s.text}`).join("\n\n---\n\n");
  return `Office excerpts:\n\n${excerpts}\n\n---\n\nQuestion: ${question}\n\nAnswer from the excerpts only, citing them like [1].`;
}

// The question used for search: a short follow-up borrows the question before it.
function searchQuery(turns: Turn[]): string {
  const users = turns.filter((t) => t.role === "user").map((t) => t.content.trim());
  const last = users.at(-1) ?? "";
  const previous = users.at(-2);
  return previous && last.split(/\s+/).length < 5 ? `${previous} ${last}` : last;
}

function citedNumbers(answer: string): Set<number> {
  const found = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const n of match[1].split(",")) found.add(Number(n.trim()));
  }
  return found;
}

// Runs one chat turn. `write` receives answer text as it is generated.
// The returned frame names the sources and, when a process answers the question, its id.
export async function answer(turns: Turn[], requested: Mode, write: (text: string) => void, signal?: AbortSignal): Promise<FinalFrame> {
  const question = turns.at(-1)?.content.trim() ?? "";
  const retrieval = await retrieve(searchQuery(turns));
  const sources = numberSources(retrieval.passages);
  const system = systemPrompt();
  const history = turns.slice(0, -1).slice(-4).map((t) => ({ role: t.role, content: t.content.slice(0, 1200) }));
  const prompt = userPrompt(question, sources);

  let mode: Mode = requested;
  let notice: string | undefined;
  let lookupOnly = false;
  let text = "";
  const emit = (piece: string) => {
    text += piece;
    write(piece);
  };

  if (mode === "cloud") {
    const cloud = await cloudStatus();
    if (!cloud.available) {
      mode = "local";
      notice = cloud.configured ? "The network is down, so Tams answered locally." : "Cloud mode is not set up, so Tams answered locally.";
    } else {
      try {
        for await (const piece of cloudStream(system, [...history, { role: "user", content: prompt }], signal)) emit(piece);
      } catch (error) {
        if (text) throw error;
        mode = "local";
        notice = `Cloud mode failed because ${cloudErrorMessage(error)}, so Tams answered locally.`;
      }
    }
  }

  if (mode === "local") {
    const state = await ollamaState();
    if (!state.reachable || !state.chatReady) {
      // No model at all. Still useful: show what the office has on the question.
      emit(offlineFallback(sources, state.reachable));
      lookupOnly = true;
      notice = notice ?? "The local model is not running, so this is a direct lookup of the office documents.";
    } else {
      const messages: ChatMessage[] = [{ role: "system", content: system }, ...history, { role: "user", content: prompt }];
      const thought = sources.length
        ? "The office excerpts are in front of me. I will answer now, briefly, from them only, and cite them."
        : "No office excerpts matched. I will reply in one or two plain sentences and cite nothing.";
      for await (const piece of chatStream(messages, thought, signal)) emit(piece);
    }
  }

  const cited = citedNumbers(text);
  const used = sources.filter((s) => cited.has(s.n));
  const shown = used.length ? used : sources;
  const frame: FinalFrame = {
    sources: shown.filter((s) => s.type === "document").map((s) => ({ docId: s.id, title: s.title, n: s.n })),
    processes: shown.filter((s) => s.type === "process").map((s) => ({ processId: s.id, title: s.title, n: s.n })),
    mode,
    model: lookupOnly ? "lookup" : mode === "cloud" ? CLOUD_MODEL : CHAT_MODEL,
    retrieval: sources.length ? retrieval.method : "none",
  };
  if (retrieval.processId && processes().some((p) => p.id === retrieval.processId)) frame.processId = retrieval.processId;
  if (notice) frame.notice = notice;
  return frame;
}

function offlineFallback(sources: NumberedSource[], ollamaRunning: boolean): string {
  const why = ollamaRunning ? "The local chat model is not installed yet (run scripts/setup.sh)." : "Ollama is not running on this machine.";
  if (!sources.length) return `${why} I also could not find anything in the office's documents that matches your question.`;
  const first = sources[0];
  return `${why} Here is what the office has on that, word for word, from ${first.title} [${first.n}]:\n\n${first.text.slice(0, 1400)}`;
}
