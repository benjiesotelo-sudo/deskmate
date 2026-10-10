import { CHAT_MODEL, EMBED_MODEL, OLLAMA_HOST } from "../config.ts";

// Everything Tams does locally goes through Ollama on this machine.

export type OllamaState = { reachable: boolean; chatReady: boolean; embedReady: boolean; models: string[] };

const matches = (installed: string, wanted: string) =>
  installed === wanted || installed === `${wanted}:latest` || installed.split(":")[0] === wanted;

export async function ollamaState(): Promise<OllamaState> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((m) => m.name);
    return {
      reachable: true,
      chatReady: models.some((m) => matches(m, CHAT_MODEL)),
      embedReady: models.some((m) => matches(m, EMBED_MODEL)),
      models,
    };
  } catch {
    return { reachable: false, chatReady: false, embedReady: false, models: [] };
  }
}

export async function embed(inputs: string[]): Promise<number[][]> {
  const res = await fetch(`${OLLAMA_HOST}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs, keep_alive: "30m" }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// The qwen3:4b build Ollama ships is a thinking-only model: even with
// think:false it reasons out loud for 10 to 20 seconds before answering.
// Handing it an already-closed thinking block makes it answer straight away,
// which is what keeps the first word under a second on an 8 GB machine.
const closedThought = (thought: string): ChatMessage => ({ role: "assistant", content: `<think>\n${thought}\n</think>\n\n` });

// Streams the answer token by token.
export async function* chatStream(messages: ChatMessage[], thought: string, signal?: AbortSignal): AsyncGenerator<string> {
  const prefill = CHAT_MODEL.startsWith("qwen3") ? [closedThought(thought)] : [];
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [...messages, ...prefill],
      stream: true,
      think: false,
      keep_alive: "30m",
      options: { temperature: 0.2, num_ctx: 4096, num_predict: 700 },
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(part, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (event.error) throw new Error(event.error);
      if (event.message?.content) yield event.message.content;
    }
  }
}

// Load the chat model into memory ahead of the first question.
export async function warmUp(): Promise<void> {
  try {
    await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: CHAT_MODEL, messages: [], think: false, keep_alive: "30m" }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    // Ollama is not running. The status endpoint reports that to the user.
  }
}
