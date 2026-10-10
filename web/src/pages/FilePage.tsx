import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, KIND_LABEL, KINDS, type Course, type DocRecord, type FilingAdvice, type Kind, type Person } from "../lib/api";
import { useSession } from "../lib/session";
import { useLoad } from "../lib/useLoad";

const COURSE_WIDE: Kind[] = ["syllabus", "book"];

function suggestTitle(course: Course | undefined, courseId: string, chapter: string, kind: Kind): string {
  if (courseId === "OFFICE") return "";
  const label = { syllabus: "Course Syllabus", deck: "Lecture Deck", materials: "Reading Notes", quiz: "Quiz", book: "Textbook Record", process: "", other: "" }[kind];
  if (!label) return "";
  if (COURSE_WIDE.includes(kind) || !chapter) return `${courseId} ${label}`;
  const title = course?.chapters.find((c) => String(c.number) === chapter)?.title;
  return `${courseId} Chapter ${chapter} ${label}${title ? ` - ${title}` : ""}`;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function FilePage() {
  const { me } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, error: loadError } = useLoad(async () => {
    const [courses, people] = await Promise.all([api<Course[]>("/api/courses"), api<Person[]>("/api/people")]);
    return { courses, people };
  }, []);

  const [course, setCourse] = useState(params.get("course") ?? "");
  const [chapter, setChapter] = useState(params.get("chapter") ?? "");
  const [kind, setKind] = useState<Kind>((params.get("kind") as Kind) ?? "deck");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<"draft" | "current">("current");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [source, setSource] = useState<"file" | "text">("file");
  const [advice, setAdvice] = useState<FilingAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const courseRecord = data?.courses.find((c) => c.id === course);
  const courseWide = COURSE_WIDE.includes(kind) || course === "OFFICE";
  const effectiveChapter = courseWide ? "" : chapter;
  const extension = source === "file" && file ? (file.name.split(".").pop() ?? "md").toLowerCase() : "md";

  useEffect(() => {
    if (!titleTouched) setTitle(suggestTitle(courseRecord, course, effectiveChapter, kind));
  }, [courseRecord, course, effectiveChapter, kind, titleTouched]);

  useEffect(() => {
    if (courseRecord) setOwner(courseRecord.coordinator);
    else if (me) setOwner(me.id);
  }, [courseRecord, me]);

  useEffect(() => {
    if (!course) {
      setAdvice(null);
      return;
    }
    const q = new URLSearchParams({ course, kind, title, extension });
    if (effectiveChapter) q.set("chapter", effectiveChapter);
    let live = true;
    api<FilingAdvice>(`/api/filing/advice?${q}`)
      .then((a) => live && setAdvice(a))
      .catch(() => live && setAdvice(null));
    return () => {
      live = false;
    };
  }, [course, effectiveChapter, kind, title, extension]);

  if (loadError) return <div className="page"><p className="notice error">{loadError}</p></div>;
  if (!data) return <div className="page" />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!course) return setError("Pick the course this belongs to.");
    if (!courseWide && !effectiveChapter && ["deck", "materials", "quiz"].includes(kind)) return setError("Pick the chapter this teaches.");
    if (source === "file" && !file) return setError("Attach the file, or switch to writing the text here.");
    if (source === "text" && !text.trim()) return setError("Write the document text, or attach a file instead.");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { title, kind, course, chapter: effectiveChapter ? Number(effectiveChapter) : null, owner, status };
      if (source === "file" && file) {
        payload.fileName = file.name;
        payload.contentBase64 = await toBase64(file);
      } else payload.text = text;
      const created = await api<DocRecord>("/api/documents", { method: "POST", json: payload });
      navigate(`/documents/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not file the document.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/cabinet">Filing cabinet</Link>
        <span>/</span>
        <span>File a document</span>
      </nav>
      <header className="page-head">
        <div>
          <h1 className="title">File a document</h1>
          <p className="subtitle">Tell Deskmate three facts - course, chapter and kind - and it tells you exactly where the file goes and what it is called.</p>
        </div>
      </header>

      <div className="doc-layout">
        <form className="card stack" onSubmit={submit}>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="f-course">Course</label>
              <select id="f-course" className="select" value={course} onChange={(e) => setCourse(e.target.value)}>
                <option value="">Choose a course</option>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} {c.title}
                  </option>
                ))}
                <option value="OFFICE">OFFICE (not one course)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-kind">Kind</label>
              <select id="f-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-chapter">Chapter</label>
              <select id="f-chapter" className="select" value={effectiveChapter} onChange={(e) => setChapter(e.target.value)} disabled={courseWide}>
                <option value="">{courseWide ? "Whole course" : "Choose a chapter"}</option>
                {courseRecord?.chapters.map((c) => (
                  <option key={c.number} value={c.number}>
                    {c.number} - {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-owner">Owner</label>
              <select id="f-owner" className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
                {data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field wide">
              <label htmlFor="f-title">Title</label>
              <input
                id="f-title"
                className="input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
              />
            </div>
            <div className="field wide">
              <span className="label">Status</span>
              <div className="seg" role="group" aria-label="Status">
                <button type="button" aria-pressed={status === "current"} onClick={() => setStatus("current")}>
                  Current - approved for use
                </button>
                <button type="button" aria-pressed={status === "draft"} onClick={() => setStatus("draft")}>
                  Draft - still being written
                </button>
              </div>
            </div>
            <div className="field wide">
              <span className="label">The document</span>
              <div className="seg" role="group" aria-label="Where the document comes from">
                <button type="button" aria-pressed={source === "file"} onClick={() => setSource("file")}>
                  Attach a file
                </button>
                <button type="button" aria-pressed={source === "text"} onClick={() => setSource("text")}>
                  Write it here
                </button>
              </div>
              {source === "file" ? (
                <>
                  <input className="input" type="file" accept=".md,.txt,.pdf,.docx" aria-label="File to attach" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <span className="small muted">Markdown, text, PDF or Word (.docx). Deskmate reads the text so Tams can answer from it.</span>
                </>
              ) : (
                <textarea className="textarea" aria-label="Document text" value={text} onChange={(e) => setText(e.target.value)} placeholder="# Title&#10;&#10;Write in plain text or markdown." />
              )}
            </div>
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy}>
              {busy ? "Filing" : "File it"}
            </button>
            <Link className="btn quiet" to="/cabinet">
              Cancel
            </Link>
          </div>
        </form>

        <aside className="card stack" aria-live="polite">
          <div>
            <p className="eyebrow">Where does this go?</p>
            {!advice && <p className="muted" style={{ marginTop: "var(--space-2)" }}>Pick a course and a kind, and the answer appears here.</p>}
          </div>
          {advice && (
            <>
              <dl className="record">
                <dt>Folder</dt>
                <dd className="mono small">{advice.folder}</dd>
                <dt>File name</dt>
                <dd className="mono small">{advice.fileName}</dd>
                <dt>Version</dt>
                <dd>{advice.version}</dd>
                <dt>Replaces</dt>
                <dd>{advice.replaces ? <Link to={`/documents/${advice.replaces.id}`}>Version {advice.replaces.version}, current</Link> : "Nothing"}</dd>
              </dl>
              <ul className="small" style={{ margin: 0, paddingLeft: "1.2em", display: "grid", gap: 6 }}>
                {advice.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="small muted">
                The rule comes from the office's own <Link to="/documents/office-filing-guide-v1">Filing and Naming Guide</Link>.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
