import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Markdown } from "../components/Markdown";
import { TamsMark } from "../components/Tams";
import { api, type TamsStatus } from "../lib/api";
import { useSession } from "../lib/session";
import { askTams, type TamsFrame, type TamsMode } from "../lib/tams";

type Message = { role: "user" | "assistant"; content: string; frame?: TamsFrame; streaming?: boolean; failed?: boolean };

const STORE = "deskmate.tams";
const SUGGESTIONS = [
  "How do I release a quiz?",
  "A faculty member sent me a revised deck. How do I file it?",
  "Someone on the team is leaving. What do we do?",
  "How is BUS101 graded?",
];

function loadStored(): { messages: Message[]; mode: TamsMode } {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) {
      const parsed = JSON.parse(raw) as { messages: Message[]; mode: TamsMode };
      return { messages: parsed.messages.map((m) => ({ ...m, streaming: false })), mode: parsed.mode };
    }
  } catch {
    // start fresh
  }
  return { messages: [], mode: "local" };
}

export function TamsPage() {
  const { me } = useSession();
  const [messages, setMessages] = useState<Message[]>(() => loadStored().messages);
  const [mode, setMode] = useState<TamsMode>(() => loadStored().mode);
  const [status, setStatus] = useState<TamsStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    const check = () =>
      api<TamsStatus>("/api/tams/status")
        .then((s) => live && setStatus(s))
        .catch(() => undefined);
    void check();
    const timer = setInterval(check, 8000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  // Cloud is only offered while it can actually be reached.
  useEffect(() => {
    if (status && mode === "cloud" && !status.cloud.available) setMode("local");
  }, [status, mode]);

  useEffect(() => {
    sessionStorage.setItem(STORE, JSON.stringify({ messages, mode }));
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, mode]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const update = (patch: Partial<Message>) => setMessages((all) => all.map((m, i) => (i === all.length - 1 ? { ...m, ...patch } : m)));
    try {
      const turns = history.filter((m) => !m.failed).map((m) => ({ role: m.role, content: m.content }));
      const { text: answer, frame } = await askTams(turns, mode, (soFar) => update({ content: soFar }), controller.signal);
      update({ content: answer || (frame.error ? "" : "(no answer)"), frame, streaming: false, failed: Boolean(frame.error) });
    } catch (e) {
      const stopped = controller.signal.aborted;
      update({
        streaming: false,
        failed: !stopped,
        frame: { sources: [], error: stopped ? undefined : e instanceof Error ? e.message : "Tams could not answer." },
      });
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  const local = status?.local;
  const cloud = status?.cloud;
  const localUp = Boolean(local?.reachable && local.chatReady);
  let line = "Checking this machine";
  let lineClass = "live";
  if (status) {
    if (mode === "cloud") {
      line = `Cloud mode - ${cloud?.model} - needs internet, excerpts leave this machine`;
      lineClass = "live cloud";
    } else if (localUp) {
      line = `Local mode - ${local?.chatModel} on this machine - works offline`;
    } else {
      line = local?.reachable ? `Local model ${local.chatModel} is not installed - run scripts/setup.sh` : "Ollama is not running - Tams can only look documents up";
      lineClass = "live down";
    }
  }
  const cloudWhy = !cloud?.configured
    ? "Cloud mode is off. Set ANTHROPIC_API_KEY to enable it."
    : !cloud.online
      ? "The network is down. Tams is answering locally."
      : "Answer with Claude over the internet.";

  return (
    <div className="tams">
      <header className="tams-head">
        <div className="tams-id">
          <TamsMark size={46} />
          <div>
            <strong>Tams</strong>
            <span className={lineClass}>{line}</span>
          </div>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Which model answers">
            <button aria-pressed={mode === "local"} onClick={() => setMode("local")} title="Answer with the model running on this machine.">
              Local (Tams, offline)
            </button>
            <button aria-pressed={mode === "cloud"} onClick={() => setMode("cloud")} disabled={!cloud?.available} title={cloudWhy}>
              Cloud (Claude)
            </button>
          </div>
          {messages.length > 0 && (
            <button className="btn small" onClick={() => setMessages([])} disabled={busy}>
              New chat
            </button>
          )}
        </div>
      </header>

      <div className="tams-scroll">
        <div className="tams-thread">
          {messages.length === 0 && (
            <div className="tams-welcome">
              <h1>
                Ask me how we do it <em>here.</em>
              </h1>
              <p>
                Hi {me?.name.split(" ")[0]}, I am Tams. I answer from this office's own documents and written processes, and I tell you which ones. If it is
                not written down, I will say so.
              </p>
              <div className="suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
              {status && (
                <p className="answer-meta" style={{ marginTop: "var(--space-5)" }}>
                  {status.index.building
                    ? "Reading the office's documents now. Answers get better in a moment."
                    : `${status.index.documents} documents and ${status.index.processes} processes indexed on this machine` +
                      (status.index.search === "embeddings" ? ` with ${status.local.embedModel}.` : status.index.search === "empty" ? "." : ", keyword search only until Ollama is running.")}
                </p>
              )}
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div className="msg user" key={i}>
                <div className="bubble">{m.content}</div>
              </div>
            ) : (
              <Answer key={i} message={m} />
            ),
          )}
          <div ref={end} />
        </div>
      </div>

      <footer className="tams-foot">
        <form className="ask" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Ask Tams how something is done in this office"
            aria-label="Your question for Tams"
          />
          {busy ? (
            <button type="button" className="btn" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          ) : (
            <button className="btn accent" disabled={!draft.trim()}>
              Ask
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}

function Answer({ message }: { message: Message }) {
  const frame = message.frame;
  const sources = [
    ...(frame?.processes ?? []).map((p) => ({ n: p.n, title: p.title, to: `/processes/${p.processId}`, type: "Process" })),
    ...(frame?.sources ?? []).map((s) => ({ n: s.n, title: s.title, to: `/documents/${s.docId}`, type: "Document" })),
  ].sort((a, b) => (a.n ?? 0) - (b.n ?? 0));

  const cite = (n: number, key: string) => {
    const source = sources.find((s) => s.n === n);
    if (source) {
      return (
        <Link key={key} to={source.to} className="cite" title={source.title}>
          {n}
        </Link>
      );
    }
    // Still streaming: show the marker. Finished: drop markers that point at nothing.
    return frame ? null : (
      <span key={key} className="cite">
        {n}
      </span>
    );
  };

  return (
    <div className="msg from-tams">
      <TamsMark size={34} />
      <div className="bubble">
        {message.content ? <Markdown text={message.content} cite={cite} /> : message.streaming ? <span className="answer-meta">Looking through the office's documents</span> : null}
        {message.streaming && <span className="typing" aria-hidden="true" />}
        {frame?.error && <p className="notice error">{frame.error}</p>}
        {frame && !frame.error && (
          <div className="sources">
            {frame.processId && (
              <div>
                <Link className="btn accent" to={`/office?play=${encodeURIComponent(frame.processId)}`}>
                  Show me in the office
                </Link>
              </div>
            )}
            {sources.length > 0 && (
              <div className="source-list" aria-label="Sources">
                {sources.map((s) => (
                  <Link key={s.to} to={s.to} className="source" title={`${s.type}: ${s.title}`}>
                    <span className="cite">{s.n}</span>
                    <span>{s.title}</span>
                  </Link>
                ))}
              </div>
            )}
            {frame.notice && <p className="notice">{frame.notice}</p>}
            <p className="answer-meta">
              {frame.mode === "cloud" ? `Answered in the cloud by ${frame.model}.` : `Answered on this machine by ${frame.model}. Nothing left the computer.`}
              {sources.length === 0 && frame.retrieval === "none" ? " No office document matched this question." : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
