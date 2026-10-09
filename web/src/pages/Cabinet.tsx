import { Link } from "react-router-dom";
import { ScopeSwitch } from "../components/ScopeSwitch";
import { api, formatDate, KIND_LABEL, type Course, type DocRecord, type Person, type Readiness } from "../lib/api";
import { useScope } from "../lib/scope";
import { useSession } from "../lib/session";
import { useLoad } from "../lib/useLoad";
import { StatusPill } from "../components/StatusPill";

export function Cabinet() {
  const { me, office } = useSession();
  const { scope, setScope, isAdmin } = useScope();
  const { data, error } = useLoad(
    async () => {
      const [courses, docs, people, readiness] = await Promise.all([
        api<Course[]>("/api/courses"),
        api<DocRecord[]>(`/api/documents?scope=${scope}`),
        api<Person[]>("/api/people"),
        api<Readiness>("/api/readiness"),
      ]);
      return { courses, docs, people, readiness };
    },
    [scope],
  );

  if (error) return <div className="page"><p className="notice error">{error}</p></div>;
  if (!data) return <div className="page" />;

  const { courses, docs, people, readiness } = data;
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const officeDocs = docs.filter((d) => d.course === "OFFICE");
  const recent = [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const drawers = courses.filter((c) => scope === "all" || docs.some((d) => d.course === c.id));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {office?.name} - {office?.term}
          </p>
          <h1 className="title">Filing cabinet</h1>
          <p className="subtitle">
            {scope === "mine"
              ? `The ${docs.length} documents you own, ${me?.name.split(" ")[0]}. Everything is filed by course, then chapter, then kind.`
              : `All ${docs.length} documents in the office, filed by course, then chapter, then kind.`}
          </p>
        </div>
        <div className="row">
          {!isAdmin && <ScopeSwitch scope={scope} setScope={setScope} />}
          <Link className="btn primary" to="/cabinet/file">
            File a document
          </Link>
        </div>
      </header>

      {drawers.length === 0 && officeDocs.length === 0 && (
        <p className="notice">You do not own any documents yet. Switch to Whole office to browse, or file your first document.</p>
      )}

      <div className="grid cols-3">
        {drawers.map((course) => {
          const mine = docs.filter((d) => d.course === course.id);
          const r = readiness.courses.find((c) => c.id === course.id);
          return (
            <Link key={course.id} to={`/cabinet/${course.id}`} className="card link drawer">
              <div>
                <p className="eyebrow">
                  {course.chapters.length} chapters - {name(course.coordinator)}
                </p>
                <p className="code">{course.id}</p>
                <p className="muted">{course.title}</p>
              </div>
              <div className="foot">
                <span className="small muted">
                  {mine.length} {scope === "mine" ? "of yours" : "documents"}
                </span>
                {r && (
                  <span className="small">
                    <strong>{r.score}%</strong> ready
                  </span>
                )}
              </div>
              {r && (
                <div className={`meter ${r.score === 100 ? "full" : ""}`}>
                  <span style={{ width: `${r.score}%` }} />
                </div>
              )}
            </Link>
          );
        })}
        {(scope === "all" || officeDocs.length > 0) && (
          <Link to="/cabinet/OFFICE" className="card link drawer">
            <div>
              <p className="eyebrow">Not tied to one course</p>
              <p className="code">OFFICE</p>
              <p className="muted">Guides, checklists and templates</p>
            </div>
            <div className="foot">
              <span className="small muted">
                {officeDocs.length} {scope === "mine" ? "of yours" : "documents"}
              </span>
            </div>
          </Link>
        )}
      </div>

      {recent.length > 0 && (
        <section className="section">
          <h2 className="h3" style={{ marginBottom: "var(--space-4)" }}>
            Last touched
          </h2>
          <div className="doclist">
            {recent.map((d) => (
              <Link key={d.id} to={`/documents/${d.id}`} className={`docrow ${d.status === "superseded" ? "old" : ""}`}>
                <span className="kind">{KIND_LABEL[d.kind]}</span>
                <span className="name">{d.title}</span>
                <span className="ver">
                  v{d.version} - {formatDate(d.updatedAt)}
                  {d.mirrored ? " - from Drive" : ""}
                </span>
                <StatusPill status={d.status} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
