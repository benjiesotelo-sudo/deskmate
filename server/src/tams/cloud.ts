import Anthropic from "@anthropic-ai/sdk";
import { CLOUD_MODEL, env } from "../config.ts";

export type CloudStatus = { configured: boolean; online: boolean; available: boolean; model: string };

let lastCheck = { at: 0, online: false };

async function isOnline(): Promise<boolean> {
  if (Date.now() - lastCheck.at < 15_000) return lastCheck.online;
  let online = false;
  try {
    await fetch("https://api.anthropic.com/", { method: "HEAD", signal: AbortSignal.timeout(2000) });
    online = true; // any HTTP answer means the network path is there
  } catch {
    online = false;
  }
  lastCheck = { at: Date.now(), online };
  return online;
}

// Cloud mode is offered only when a key is set and the network is actually up.
export async function cloudStatus(): Promise<CloudStatus> {
  const configured = Boolean(env("ANTHROPIC_API_KEY"));
  const online = configured ? await isOnline() : false;
  return { configured, online, available: configured && online, model: CLOUD_MODEL };
}

export function cloudErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "the Anthropic API key was rejected";
  if (error instanceof Anthropic.PermissionDeniedError) return "the Anthropic API key is not allowed to use this model";
  if (error instanceof Anthropic.RateLimitError) return "the cloud model is rate limited right now";
  if (error instanceof Anthropic.APIConnectionError) return "the network connection to the cloud model failed";
  if (error instanceof Anthropic.APIError) return `the cloud model returned an error (${error.status ?? "unknown"})`;
  return "the cloud model could not be reached";
}

export type CloudTurn = { role: "user" | "assistant"; content: string };

// Same grounding as local mode: the excerpts travel in the request, the model is told to use only them.
export async function* cloudStream(system: string, messages: CloudTurn[], signal?: AbortSignal): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const stream = client.messages.stream(
    {
      model: CLOUD_MODEL,
      max_tokens: 8000,
      system,
      messages,
      output_config: { effort: "low" },
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new Error("The cloud model declined to answer this question.");
}
