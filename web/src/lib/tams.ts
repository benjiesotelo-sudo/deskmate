// Client for POST /api/tams/chat.
// The response is plain text streamed as it is generated. When the answer is
// complete, one record separator character (0x1E) follows, then one JSON frame.

export type TamsMode = "local" | "cloud";
export type TamsTurn = { role: "user" | "assistant"; content: string };

export type TamsFrame = {
  sources: { docId: string; title: string; n?: number }[];
  processes?: { processId: string; title: string; n?: number }[];
  processId?: string;
  mode?: TamsMode;
  model?: string;
  retrieval?: "embeddings" | "keywords" | "none";
  notice?: string;
  error?: string;
};

const SEPARATOR = "\u001e";

export async function askTams(
  messages: TamsTurn[],
  mode: TamsMode,
  onText: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; frame: TamsFrame }> {
  const res = await fetch("/api/tams/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ messages, mode }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Tams could not answer (${res.status}).`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    const cut = raw.indexOf(SEPARATOR);
    onText(cut >= 0 ? raw.slice(0, cut) : raw);
  }
  const cut = raw.indexOf(SEPARATOR);
  const text = cut >= 0 ? raw.slice(0, cut) : raw;
  let frame: TamsFrame = { sources: [] };
  if (cut >= 0) {
    try {
      frame = JSON.parse(raw.slice(cut + 1)) as TamsFrame;
    } catch {
      frame = { sources: [], error: "Tams' answer ended unexpectedly." };
    }
  }
  return { text, frame };
}
