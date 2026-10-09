import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import {
  api,
  ApiError,
  formatDateTime,
  KIND_LABEL,
  type Course,
  type DocRecord,
  type DriveEntry,
  type DriveFileState,
  type DriveFolder,
  type DriveJob,
  type DriveStatus,
} from "../lib/api";
import "./drive.css";

const STATE_LABEL: Record<DriveFileState, string> = {
  folder: "",
  local: "Local",
  remote: "Not yet local",
  changed: "Changed in Drive",
  stays: "Stays in Drive",
};
const STATE_PILL: Record<DriveFileState, string> = { folder: "", local: "current", remote: "draft", changed: "draft", stays: "superseded" };

const PHASE: Record<DriveJob["phase"], string> = {
  listing: "Reading the folder in Drive",
  downloading: "Downloading",
  records: "Exchanging records with Drive",
  indexing: "Teaching Tams the new files",
  done: "Done",
  failed: "Stopped",
};

function megabytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const slot = (d: { course: string; chapter: number | null; kind: keyof typeof KIND_LABEL }) =>
  `${d.course} / ${d.chapter ? `Chapter ${d.chapter}` : d.course === "OFFICE" ? "Office" : "Whole course"} / ${KIND_LABEL[d.kind]}`;

// The Drive mirror: connect a folder, see it beside the local cabinet, sync it, take it offline.
export function DriveMirror({ notice }: { notice?: string | null }) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wasRunning = useRef(false);

  const loadTree = useCallback(async () => {
    const [tree, documents, courseList] = await Promise.all([api<DriveEntry[]>("/api/drive/tree"), api<DocRecord[]>("/api/documents"), api<Course[]>("/api/courses")]);
    setEntries(tree);
    setDocs(documents);
    setCourses(courseList);
  }, []);

  const loadStatus = useCallback(async () => {
    const next = await api<DriveStatus>("/api/drive/status");
    setStatus(next);
    return next;
  }, []);

  const running = Boolean(status?.job && !status.job.finishedAt);

  // Follow a running job closely; otherwise look in now and then so "offline" shows up by itself.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await loadStatus();
        const active = Boolean(next.job && !next.job.finishedAt);
        if (active || wasRunning.current) await loadTree();
        wasRunning.current = active;
        if (live) timer = setTimeout(tick, active ? 700 : 5_000);
      } catch (e) {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Could not load the Drive mirror.");
        timer = setTimeout(tick, 5_000);
      }
    };
    void loadTree().catch(() => undefined);
    void tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [loadStatus, loadTree, running]);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      setStatus(await api<DriveStatus>(path, { method: "POST", json: body ?? {} }));
      await loadTree();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
      // An offline answer changes what the screen should say, so refresh it.
      if (e instanceof ApiError && e.status === 503) await loadStatus().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <section className="card stack drive">{error ? <p className="notice error">{error}</p> : <p className="muted">Loading the Drive mirror</p>}</section>;

  const { connection, account, job, counts } = status;
  const everythingLocal = Boolean(connection) && counts.files > 0 && counts.notLocal === 0;

  return (
    <section className="card stack drive" id="drive">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow">Google Drive mirror</p>
          <h2 className="h2">{connection ? connection.folderName : "Connect a Drive folder"}</h2>
          <p className="small muted" style={{ maxWidth: "62ch" }}>
            The office's Drive folder is copied onto this computer and filed into the cabinet, so the documents stay readable and Tams keeps answering
            when the internet is gone.
          </p>
        </div>
        {status.configured && (account || connection) && (
          <span className={`pill ${status.online ? "current" : "missing"}`}>{status.online ? "Google is reachable" : "Offline"}</span>
        )}
      </div>

      {notice && <p className="notice">{notice}</p>}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      {!status.configured && (
        <p className="notice">
          Google is not configured on this machine. Put <span className="mono">GOOGLE_CLIENT_ID</span> and <span className="mono">GOOGLE_CLIENT_SECRET</span>{" "}
          in <span className="mono">~/.deskmate-google.env</span> and restart Deskmate. Everything else in Deskmate works without it.
        </p>
      )}

      {status.configured && !connection && !account?.connected && (
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          <p>Connect the Google account that can open the office's Drive folder. Your Deskmate account and password stay as they are.</p>
          <div className="row">
            <a className="btn primary" href="/auth/google?link=1">
              Connect a Google account
            </a>
            {!status.online && <span className="small muted">Needs the internet. This machine looks offline right now.</span>}
          </div>
        </div>
      )}

      {status.configured && !connection && account?.connected && !account.driveGranted && (
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          <p className="notice">
            {account.email} is connected, but Deskmate was not given access to Google Drive. Connect again and tick the Drive box on Google's screen.
          </p>
          <div className="row">
            <a className="btn primary" href="/auth/google?link=1&consent=1">
              Connect Google again
            </a>
          </div>
        </div>
      )}

      {status.configured && !connection && account?.connected && account.driveGranted && (
        <FolderChooser email={account.email} online={status.online} busy={busy} onConnect={(folder) => void act("/api/drive/connect", { folder })} />
      )}

      {connection && (
        <>
          <div className="drive-status">
            <div>
              <p className={`drive-line ${everythingLocal ? "ok" : ""}`}>{status.statusLine}</p>
              <p className="small muted">
                {status.online ? "" : "Offline. "}
                {status.lastSync ? `Last synced ${formatDateTime(status.lastSync)}.` : "Not synced yet."}
                {!status.online && " The mirrored cabinet and Tams keep working from the files on this computer."}
              </p>
            </div>
            <div className="row">
              <button className="btn primary" disabled={busy || running || !status.online} onClick={() => void act("/api/drive/sync")}>
                {running && job?.kind === "sync" ? "Syncing" : "Sync"}
              </button>
              <button className="btn" disabled={busy || running || !status.online} onClick={() => void act("/api/drive/download")}>
                {running && job?.kind === "download" ? "Downloading" : "Download everything"}
              </button>
            </div>
          </div>

          {job && <JobLine job={job} />}

          <dl className="record drive-facts">
            <dt>Drive folder</dt>
            <dd>
              {connection.link ? (
                <a href={connection.link} target="_blank" rel="noreferrer">
                  {connection.folderName}
                </a>
              ) : (
                connection.folderName
              )}{" "}
              <span className="muted">through {connection.accountEmail}</span>
            </dd>
            <dt>Kept on this computer</dt>
            <dd className="mono small">{connection.mirrorFolder}</dd>
            <dt>In the folder</dt>
            <dd>
              {counts.files} {counts.files === 1 ? "file" : "files"}: {counts.local} local, {counts.notLocal} not yet local, {counts.filed} filed in the cabinet
              {counts.staysInDrive > 0 ? `, ${counts.staysInDrive} that can only stay in Drive` : ""}
            </dd>
            {counts.recordsToSend > 0 && (
              <>
                <dt>Records edited here</dt>
                <dd>
                  {counts.recordsToSend} {counts.recordsToSend === 1 ? "record waits" : "records wait"} to be written to Drive on the next sync
                </dd>
              </>
            )}
          </dl>

          <div className="drive-columns">
            <div>
              <p className="eyebrow">In Google Drive</p>
              <DriveTree entries={entries} rootId={connection.folderId} />
            </div>
            <div>
              <p className="eyebrow">In the local cabinet</p>
              <CabinetTree docs={docs} courses={courses} />
            </div>
          </div>

          <div className="row small muted">
            <span>
              Sync pulls the documents Deskmate can read: Google Docs, Sheets and Slides, PDF, Word, markdown and text. Download everything also fetches
              the rest.
            </span>
            {status.canManage && (
              <button className="btn quiet small" disabled={busy || running} onClick={() => void act("/api/drive/disconnect")}>
                Disconnect this folder
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function JobLine({ job }: { job: DriveJob }) {
  const running = !job.finishedAt;
  const percent = job.total ? Math.round((job.done / job.total) * 100) : running ? 0 : 100;
  const what = job.kind === "sync" ? "Sync" : "Download everything";
  if (running) {
    return (
      <div className="drive-job" role="status">
        <div className="spread small">
          <strong>
            {what}: {PHASE[job.phase]}
            {job.phase === "downloading" && job.total > 0 ? ` ${job.done} of ${job.total}` : ""}
          </strong>
          <span className="muted">{job.bytes > 0 ? megabytes(job.bytes) : ""}</span>
        </div>
        <div className="meter">
          <span style={{ width: `${job.phase === "listing" ? 4 : Math.max(4, percent)}%` }} />
        </div>
        <p className="small muted drive-current">{job.current ?? " "}</p>
      </div>
    );
  }
  const parts = [
    job.total === 0 && job.pushed === 0 && job.pulled === 0 ? "nothing new in Drive" : null,
    job.filed ? `${job.filed} filed into the cabinet` : null,
    job.updated ? `${job.updated} updated` : null,
    job.pushed ? `${job.pushed} ${job.pushed === 1 ? "record" : "records"} written to Drive` : null,
    job.pulled ? `${job.pulled} ${job.pulled === 1 ? "record" : "records"} read from Drive` : null,
    job.bytes ? megabytes(job.bytes) : null,
  ].filter(Boolean);
  return (
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      {job.phase === "failed" ? (
        <p className="notice error">
          {what} stopped at {formatDateTime(job.finishedAt!)}. {job.message}
        </p>
      ) : (
        <p className="notice ok">
          {what} finished at {formatDateTime(job.finishedAt!)}: {parts.join(", ")}.
        </p>
      )}
      {job.errors.length > 0 && (
        <div className="notice">
          {job.errors.length} {job.errors.length === 1 ? "file" : "files"} could not be downloaded:
          <ul className="drive-errors">
            {job.errors.slice(0, 8).map((e) => (
              <li key={e.name}>
                <strong>{e.name}</strong> - {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DriveTree({ entries, rootId }: { entries: DriveEntry[]; rootId: string }) {
  const children = useMemo(() => {
    const map = new Map<string, DriveEntry[]>();
    for (const entry of entries) {
      const key = entry.parentId ?? rootId;
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    for (const list of map.values()) list.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name));
    return map;
  }, [entries, rootId]);

  if (!entries.length) return <p className="muted small drive-empty">This folder is empty in Drive.</p>;

  const render = (parentId: string, depth: number): React.ReactNode =>
    (children.get(parentId) ?? []).map((entry) =>
      entry.isFolder ? (
        <div key={entry.id}>
          <div className="drive-row folder" style={{ paddingLeft: depth * 18 }}>
            <FolderGlyph />
            <span className="drive-name">{entry.name}</span>
          </div>
          {render(entry.id, depth + 1)}
        </div>
      ) : (
        <div key={entry.id} className="drive-row" style={{ paddingLeft: depth * 18 }}>
          <FileGlyph />
          <div className="drive-file">
            <span className="drive-name" title={entry.path}>
              {entry.name}
            </span>
            {entry.doc ? (
              <span className="small muted">
                Filed as {slot(entry.doc)}
                {entry.doc.recordPending ? " - record edited here, goes to Drive on the next sync" : ""} -{" "}
                <Link to={`/documents/${entry.doc.id}?edit=1`}>Edit the record</Link>
              </span>
            ) : entry.note ? (
              <span className="small muted">{entry.note}</span>
            ) : null}
          </div>
          <span className={`pill ${STATE_PILL[entry.state]}`}>{STATE_LABEL[entry.state]}</span>
        </div>
      ),
    );
  return <div className="drive-tree">{render(rootId, 0)}</div>;
}

function CabinetTree({ docs, courses }: { docs: DocRecord[]; courses: Course[] }) {
  const groups = [...courses.map((c) => ({ id: c.id, title: c.title })), { id: "OFFICE", title: "Guides, checklists and templates" }];
  const mirrored = docs.filter((d) => d.mirrored).length;
  return (
    <div className="drive-tree">
      {groups.map((group) => {
        const here = docs.filter((d) => d.course === group.id && d.status !== "superseded");
        if (!here.length) return null;
        const chapters = [...new Set(here.map((d) => d.chapter))].sort((a, b) => (a ?? 0) - (b ?? 0));
        return (
          <div key={group.id}>
            <div className="drive-row folder">
              <FolderGlyph />
              <span className="drive-name">
                {group.id} <span className="muted">{group.title}</span>
              </span>
            </div>
            {chapters.map((chapter) => (
              <div key={String(chapter)}>
                {group.id !== "OFFICE" && (
                  <div className="drive-row folder" style={{ paddingLeft: 18 }}>
                    <FolderGlyph />
                    <span className="drive-name">{chapter ? `Chapter ${chapter}` : "Whole course"}</span>
                  </div>
                )}
                {here
                  .filter((d) => d.chapter === chapter)
                  .map((d) => (
                    <Link key={d.id} to={`/documents/${d.id}`} className={`drive-row link ${d.mirrored ? "mirrored" : ""}`} style={{ paddingLeft: group.id === "OFFICE" ? 18 : 36 }}>
                      <FileGlyph />
                      <div className="drive-file">
                        <span className="drive-name">{d.title}</span>
                        <span className="small muted">
                          {KIND_LABEL[d.kind]} v{d.version}
                          {d.mirrored ? " - mirrored from Drive" : " - filed on this computer"}
                        </span>
                      </div>
                      <StatusPill status={d.status} />
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        );
      })}
      <p className="small muted drive-empty">
        {mirrored} of {docs.length} documents in the cabinet came from Drive. Superseded versions are not shown here.
      </p>
    </div>
  );
}

function FolderChooser(props: { email: string; online: boolean; busy: boolean; onConnect: (folder: string) => void }) {
  const [pasted, setPasted] = useState("");
  const [place, setPlace] = useState<"mine" | "shared">("mine");
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState<DriveFolder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const here = trail.at(-1);

  useEffect(() => {
    let live = true;
    setFolders(null);
    setError(null);
    const q = new URLSearchParams();
    if (query) q.set("search", query);
    else if (here) q.set("parent", here.id);
    else if (place === "shared") q.set("shared", "1");
    api<DriveFolder[]>(`/api/drive/folders?${q}`)
      .then((list) => live && setFolders(list))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Could not list your Drive folders."));
    return () => {
      live = false;
    };
  }, [place, here?.id, query]);

  function paste(event: FormEvent) {
    event.preventDefault();
    if (pasted.trim()) props.onConnect(pasted.trim());
  }

  return (
    <div className="stack">
      <p>
        Signed in to Google as <strong>{props.email}</strong>. Pick the folder that holds the office's documents, or paste its link.
      </p>
      <form className="drive-paste" onSubmit={paste}>
        <input
          className="input"
          aria-label="Drive folder link or ID"
          placeholder="https://drive.google.com/drive/folders/... or a folder ID"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button className="btn primary" disabled={props.busy || !pasted.trim()}>
          {props.busy ? "Connecting" : "Connect"}
        </button>
      </form>

      <div className="drive-picker">
        <div className="spread">
          <div className="seg" role="group" aria-label="Where to look">
            <button
              type="button"
              aria-pressed={place === "mine" && !query}
              onClick={() => {
                setPlace("mine");
                setTrail([]);
                setQuery("");
                setSearch("");
              }}
            >
              My Drive
            </button>
            <button
              type="button"
              aria-pressed={place === "shared" && !query}
              onClick={() => {
                setPlace("shared");
                setTrail([]);
                setQuery("");
                setSearch("");
              }}
            >
              Shared with me
            </button>
          </div>
          <form
            className="drive-paste"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
          >
            <input className="input" aria-label="Search folders by name" placeholder="Search folders by name" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn small">Search</button>
          </form>
        </div>

        {!query && (
          <div className="crumbs" style={{ margin: 0 }}>
            <button type="button" className="drive-crumb" onClick={() => setTrail([])}>
              {place === "mine" ? "My Drive" : "Shared with me"}
            </button>
            {trail.map((t, i) => (
              <span key={t.id} className="row" style={{ gap: "var(--space-2)" }}>
                <span>/</span>
                <button type="button" className="drive-crumb" onClick={() => setTrail(trail.slice(0, i + 1))}>
                  {t.name}
                </button>
              </span>
            ))}
          </div>
        )}
        {query && <p className="small muted">Folders with "{query}" in the name</p>}

        {error && <p className="notice error">{error}</p>}
        {!error && folders === null && <p className="small muted">Looking in Drive</p>}
        {folders && folders.length === 0 && <p className="small muted">No folders here.</p>}
        {folders && folders.length > 0 && (
          <div className="drive-tree">
            {folders.map((f) => (
              <div key={f.id} className="drive-row">
                <FolderGlyph />
                <button
                  type="button"
                  className="drive-open"
                  title="Look inside"
                  onClick={() => {
                    setQuery("");
                    setSearch("");
                    setTrail(query ? [{ id: f.id, name: f.name }] : [...trail, { id: f.id, name: f.name }]);
                  }}
                >
                  {f.name}
                </button>
                <button type="button" className="btn small" disabled={props.busy} onClick={() => props.onConnect(f.id)}>
                  Connect this folder
                </button>
              </div>
            ))}
          </div>
        )}
        {here && !query && (
          <div className="row">
            <button type="button" className="btn primary small" disabled={props.busy} onClick={() => props.onConnect(here.id)}>
              Connect "{here.name}"
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FolderGlyph() {
  return (
    <svg className="drive-glyph" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 16 6.3v7.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 2 13.5z" fill="currentColor" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg className="drive-glyph file" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4.5 2h6L14 5.5v9A1.5 1.5 0 0 1 12.5 16h-8A1.5 1.5 0 0 1 3 14.500v-11A1.5 1.5 0 0 1 4.500 2z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.200 2.300v3.500h3.500" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
