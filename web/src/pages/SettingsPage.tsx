import { useState } from "react";
import { api, type TamsStatus } from "../lib/api";
import { useSession } from "../lib/session";
import { useLoad } from "../lib/useLoad";

type GoogleStatus = { configured: boolean; ready: boolean; message: string };

// Optional parts that are simply switched off read as "Off", not as a fault.
function Line({ ok, optional, children }: { ok: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
      <span className={`pill ${ok ? "current" : optional ? "superseded" : "missing"}`}>{ok ? "Ready" : optional ? "Off" : "Not ready"}</span>
      <span>{children}</span>
    </div>
  );
}

export function SettingsPage() {
  const { me, office } = useSession();
  const isAdmin = me?.access === "admin";
  const [reindexing, setReindexing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data, error, reload } = useLoad(async () => {
    const [tams, google, storage] = await Promise.all([
      api<TamsStatus>("/api/tams/status"),
      api<GoogleStatus>("/auth/google/status"),
      isAdmin ? api<{ officeFolder: string; documents: number }>("/api/admin/storage") : Promise.resolve(null),
    ]);
    return { tams, google, storage };
  }, [isAdmin]);

  async function reindex() {
    setReindexing(true);
    setMessage(null);
    try {
      const s = await api<{ chunks: number; embedded: number; documents: number; processes: number }>("/api/admin/reindex", { method: "POST" });
      setMessage(`Rebuilt: ${s.documents} documents and ${s.processes} processes in ${s.chunks} passages, ${s.embedded} with embeddings.`);
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not rebuild the index.");
    } finally {
      setReindexing(false);
    }
  }

  if (error) return <div className="page"><p className="notice error">{error}</p></div>;
  if (!data) return <div className="page" />;
  const { tams, google, storage } = data;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{office?.name}</p>
          <h1 className="title">Settings</h1>
          <p className="subtitle">What is running on this machine, and what would need the internet.</p>
        </div>
      </header>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <section className="card stack">
          <h2 className="h3">Your account</h2>
          <dl className="record">
            <dt>Name</dt>
            <dd>{me?.name}</dd>
            <dt>Role</dt>
            <dd>{me?.role}</dd>
            <dt>Username</dt>
            <dd className="mono">{me?.username}</dd>
            <dt>Email</dt>
            <dd>{me?.email}</dd>
            <dt>Access</dt>
            <dd>{isAdmin ? "Admin - sees and edits the whole office" : "Staff - edits what they own, reads the rest"}</dd>
          </dl>
        </section>

        <section className="card stack">
          <h2 className="h3">Tams, on this machine</h2>
          <Line ok={tams.local.reachable}>Ollama {tams.local.reachable ? "is running locally" : "is not running. Start Ollama, then reload."}</Line>
          <Line ok={tams.local.chatReady}>
            Chat model <span className="mono">{tams.local.chatModel}</span>
          </Line>
          <Line ok={tams.local.embedReady}>
            Embedding model <span className="mono">{tams.local.embedModel}</span>
          </Line>
          <Line ok={tams.index.chunks > 0}>
            Index: {tams.index.documents} documents and {tams.index.processes} processes in {tams.index.chunks} passages, {tams.index.embedded} with
            embeddings{tams.index.building ? " (building now)" : ""}
          </Line>
          {isAdmin && (
            <div className="row">
              <button className="btn" onClick={() => void reindex()} disabled={reindexing}>
                {reindexing ? "Rebuilding" : "Rebuild the index"}
              </button>
              <span className="small muted">
                Same as <span className="mono">npm run index</span>
              </span>
            </div>
          )}
          {message && <p className="notice ok">{message}</p>}
        </section>

        <section className="card stack">
          <h2 className="h3">Cloud mode (optional)</h2>
          <Line ok={tams.cloud.configured} optional>
            {tams.cloud.configured ? "An Anthropic API key is set" : "No Anthropic API key is set, so Tams stays fully local"}
          </Line>
          <Line ok={tams.cloud.online} optional={!tams.cloud.configured}>{tams.cloud.online ? "The internet is reachable" : tams.cloud.configured ? "The internet is not reachable right now" : "Not checked while cloud mode is off"}</Line>
          <p className="small muted">
            When both are ready, the chat header offers Cloud (Claude) using <span className="mono">{tams.cloud.model}</span>. In cloud mode the excerpts
            Tams found are sent to Anthropic to write the answer. In local mode nothing leaves this computer.
          </p>
        </section>

        <section className="card stack">
          <h2 className="h3">Google sign-in and Drive</h2>
          <Line ok={google.ready} optional>{google.message}</Line>
          <p className="small muted">Username and password sign-in always works, with or without the internet.</p>
          {storage && (
            <dl className="record">
              <dt>Office folder</dt>
              <dd className="mono small">{storage.officeFolder}</dd>
              <dt>Documents</dt>
              <dd>{storage.documents}</dd>
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
