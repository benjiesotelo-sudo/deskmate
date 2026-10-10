import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Markdown } from "../components/Markdown";
import { StatusPill } from "../components/StatusPill";
import { api, formatDate, KIND_LABEL, KINDS, STATUSES, type Course, type DocDetail, type DocRecord, type Person } from "../lib/api";
import { useSession } from "../lib/session";
import { useLoad } from "../lib/useLoad";

export function DocumentPage() {
  const { id = "" } = useParams();
  const { me } = useSession();
  // The Drive screen links straight to the record form with ?edit=1.
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(params.get("edit") === "1");
  const [saved, setSaved] = useState<string | null>(null);
  const { data, error, reload } = useLoad(
    async () => {
      const [doc, courses, people] = await Promise.all([
        api<DocDetail>(`/api/documents/${encodeURIComponent(id)}`),
        api<Course[]>("/api/courses"),
        api<Person[]>("/api/people"),
      ]);
      return { doc, courses, people };
    },
    [id],
  );

  if (error) return <div className="page"><p className="notice error">{error}</p></div>;
  if (!data) return <div className="page" />;

  const { doc, courses, people } = data;
  const name = (pid: string) => people.find((p) => p.id === pid)?.name ?? pid;
  const course = courses.find((c) => c.id === doc.course);
  const chapterTitle = course?.chapters.find((c) => c.number === doc.chapter)?.title;
  const current = doc.versions.find((v) => v.status === "current");
  const isMarkdown = /\.(md|txt)$/i.test(doc.fileName);

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/cabinet">Filing cabinet</Link>
        <span>/</span>
        <Link to={`/cabinet/${doc.course}`}>{doc.course}</Link>
        <span>/</span>
        <span>{doc.chapter ? `Chapter ${doc.chapter}` : doc.course === "OFFICE" ? "Office" : "Whole course"}</span>
        <span>/</span>
        <span>{KIND_LABEL[doc.kind]}</span>
      </nav>
      <header className="page-head">
        <div>
          <div className="row" style={{ marginBottom: "var(--space-2)" }}>
            <StatusPill status={doc.status} />
            <span className="pill plain">Version {doc.version}</span>
            {doc.mirrored && <span className="pill plain">From Google Drive</span>}
          </div>
          <h1 className="title">{doc.title}</h1>
        </div>
        <div className="row">
          {doc.fileExists && (
            <a className="btn" href={`/api/documents/${doc.id}/file`}>
              Download original
            </a>
          )}
          {doc.canEdit && !editing && (
            <button className="btn primary" onClick={() => setEditing(true)}>
              Edit record
            </button>
          )}
        </div>
      </header>

      {saved && <p className="notice ok" style={{ marginBottom: "var(--space-4)" }}>{saved}</p>}
      {doc.status === "superseded" && current && current.id !== doc.id && (
        <p className="notice" style={{ marginBottom: "var(--space-4)" }}>
          This is an older version kept for the record. <Link to={`/documents/${current.id}`}>Open the current one, version {current.version}</Link>.
        </p>
      )}
      {doc.mirrored && (
        <p className="notice ok" style={{ marginBottom: "var(--space-4)" }}>
          This file is mirrored from the office's Google Drive folder and kept on this computer. Edit its record here and the next sync writes the
          record beside the file in Drive.
        </p>
      )}
      {doc.status === "draft" && (
        <p className="notice" style={{ marginBottom: "var(--space-4)" }}>
          This is a draft. It does not count toward accreditation readiness until its status is current.
        </p>
      )}

      <div className="doc-layout">
        <article className="sheet">
          {doc.text.trim() ? (
            isMarkdown ? (
              <Markdown text={doc.text} />
            ) : (
              <div className="prose" style={{ whiteSpace: "pre-wrap" }}>
                {doc.text}
              </div>
            )
          ) : (
            <p className="muted">No readable text could be taken from this file. Download the original to open it.</p>
          )}
        </article>

        <aside className="stack">
          <div className="card">
            {editing && doc.canEdit ? (
              <EditRecord
                doc={doc}
                courses={courses}
                people={people}
                isAdmin={me?.access === "admin"}
                onCancel={() => setEditing(false)}
                onSaved={(message) => {
                  setEditing(false);
                  setSaved(message);
                  reload();
                }}
              />
            ) : (
              <>
                <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>
                  Record
                </p>
                <dl className="record">
                  <dt>Course</dt>
                  <dd>{course ? `${course.id} ${course.title}` : doc.course}</dd>
                  <dt>Chapter</dt>
                  <dd>{doc.chapter ? `${doc.chapter}${chapterTitle ? ` - ${chapterTitle}` : ""}` : "Whole course"}</dd>
                  <dt>Kind</dt>
                  <dd>{KIND_LABEL[doc.kind]}</dd>
                  <dt>Term</dt>
                  <dd>{doc.term}</dd>
                  <dt>Owner</dt>
                  <dd>{name(doc.owner)}</dd>
                  <dt>Version</dt>
                  <dd>{doc.version}</dd>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={doc.status} />
                  </dd>
                  <dt>Updated</dt>
                  <dd>{formatDate(doc.updatedAt)}</dd>
                  <dt>Filed at</dt>
                  <dd className="mono small">{doc.path}</dd>
                </dl>
                {!doc.canEdit && <p className="small muted" style={{ marginTop: "var(--space-4)" }}>Only {name(doc.owner)} or an office admin can edit this record.</p>}
              </>
            )}
          </div>

          {doc.versions.length > 1 && (
            <div className="card">
              <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>
                All versions
              </p>
              <div className="stack" style={{ gap: "var(--space-2)" }}>
                {doc.versions.map((v: DocRecord) => (
                  <Link key={v.id} to={`/documents/${v.id}`} className="spread small" style={{ textDecoration: "none" }}>
                    <span style={{ fontWeight: v.id === doc.id ? 720 : 420 }}>
                      Version {v.version} - {formatDate(v.updatedAt)}
                    </span>
                    <StatusPill status={v.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EditRecord(props: {
  doc: DocDetail;
  courses: Course[];
  people: Person[];
  isAdmin: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { doc, courses, people } = props;
  const [form, setForm] = useState({
    title: doc.title,
    course: doc.course,
    chapter: doc.chapter === null ? "" : String(doc.chapter),
    kind: doc.kind,
    term: doc.term,
    owner: doc.owner,
    version: String(doc.version),
    status: doc.status,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const chapters = courses.find((c) => c.id === form.course)?.chapters ?? [];

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        course: form.course,
        chapter: form.chapter === "" ? null : Number(form.chapter),
        kind: form.kind,
        term: form.term,
        version: Number(form.version),
        status: form.status,
      };
      if (props.isAdmin) payload.owner = form.owner;
      const result = await api<DocRecord & { superseded: string[] }>(`/api/documents/${doc.id}`, { method: "PATCH", json: payload });
      props.onSaved(
        result.superseded.length
          ? `Saved. This is now the current version, and ${result.superseded.length} older document was marked superseded.`
          : "Saved. The cabinet, the readiness screen and Tams all use the new record.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <p className="eyebrow">Edit record</p>
      {error && <p className="notice error">{error}</p>}
      <div className="field">
        <label htmlFor="e-title">Title</label>
        <input id="e-title" className="input" value={form.title} onChange={set("title")} />
      </div>
      <div className="field">
        <label htmlFor="e-course">Course</label>
        <select id="e-course" className="select" value={form.course} onChange={set("course")}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} {c.title}
            </option>
          ))}
          <option value="OFFICE">OFFICE (not one course)</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="e-chapter">Chapter</label>
        <select id="e-chapter" className="select" value={form.chapter} onChange={set("chapter")}>
          <option value="">Whole course</option>
          {chapters.map((c) => (
            <option key={c.number} value={c.number}>
              {c.number} - {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="e-kind">Kind</label>
        <select id="e-kind" className="select" value={form.kind} onChange={set("kind")}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="e-term">Term</label>
        <input id="e-term" className="input" value={form.term} onChange={set("term")} />
      </div>
      <div className="field">
        <label htmlFor="e-owner">Owner</label>
        <select id="e-owner" className="select" value={form.owner} onChange={set("owner")} disabled={!props.isAdmin}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!props.isAdmin && <span className="small muted">Ownership changes through an office admin, as part of a handover.</span>}
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="e-version">Version</label>
          <input id="e-version" className="input" type="number" min={1} value={form.version} onChange={set("version")} />
        </div>
        <div className="field">
          <label htmlFor="e-status">Status</label>
          <select id="e-status" className="select" value={form.status} onChange={set("status")}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="row">
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving" : "Save record"}
        </button>
        <button type="button" className="btn quiet" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
