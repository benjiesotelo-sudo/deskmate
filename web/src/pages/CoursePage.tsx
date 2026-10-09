import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ScopeSwitch } from "../components/ScopeSwitch";
import { StatusPill } from "../components/StatusPill";
import { api, fileLink, KIND_LABEL, KINDS, type Course, type DocRecord, type Kind, type Person } from "../lib/api";
import { useScope } from "../lib/scope";
import { useLoad } from "../lib/useLoad";

const REQUIRED: Kind[] = ["deck", "materials", "quiz"];

export function CoursePage() {
  const { course: courseId = "" } = useParams();
  const { scope, setScope, isAdmin } = useScope();
  const [kind, setKind] = useState<Kind | "all">("all");
  const { data, error } = useLoad(
    async () => {
      const [courses, docs, people] = await Promise.all([
        api<Course[]>("/api/courses"),
        api<DocRecord[]>(`/api/documents?course=${encodeURIComponent(courseId)}&scope=${scope}`),
        api<Person[]>("/api/people"),
      ]);
      return { courses, docs, people };
    },
    [courseId, scope],
  );

  if (error) return <div className="page"><p className="notice error">{error}</p></div>;
  if (!data) return <div className="page" />;

  const course = data.courses.find((c) => c.id === courseId);
  const isOffice = courseId === "OFFICE";
  if (!course && !isOffice) {
    return (
      <div className="page">
        <p className="notice error">There is no course called {courseId} in this office.</p>
      </div>
    );
  }
  const name = (id: string) => data.people.find((p) => p.id === id)?.name ?? id;
  const shown = data.docs.filter((d) => kind === "all" || d.kind === kind);
  const kindsHere = KINDS.filter((k) => data.docs.some((d) => d.kind === k));

  const rows = (chapter: number | null, required: Kind[]) => {
    const here = shown.filter((d) => d.chapter === chapter);
    const order = (d: DocRecord) => KINDS.indexOf(d.kind) * 100 - d.version;
    const out = [...here]
      .sort((a, b) => order(a) - order(b))
      .map((d) => (
        <Link key={d.id} to={`/documents/${d.id}`} className={`docrow ${d.status === "superseded" ? "old" : ""}`}>
          <span className="kind">{KIND_LABEL[d.kind]}</span>
          <span className="name">{d.title}</span>
          <span className="ver">
            v{d.version} - {name(d.owner)}
          </span>
          <StatusPill status={d.status} />
        </Link>
      ));
    // Name the gaps where they belong, so the empty slot is as visible as a filed one.
    if (scope === "all") {
      for (const k of required) {
        if (kind !== "all" && kind !== k) continue;
        if (data.docs.some((d) => d.chapter === chapter && d.kind === k)) continue;
        out.push(
          <Link key={`gap-${k}`} to={fileLink({ course: courseId, chapter, kind: k })} className="docrow gap">
            <span className="kind">{KIND_LABEL[k]}</span>
            <span className="name">Nothing filed yet</span>
            <span className="ver">File it</span>
            <StatusPill status="missing" />
          </Link>,
        );
      }
    }
    return out.length ? out : [<p key="none" className="small muted">Nothing here{kind !== "all" ? ` of kind ${KIND_LABEL[kind]}` : ""}.</p>];
  };

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/cabinet">Filing cabinet</Link>
        <span>/</span>
        <span>{courseId}</span>
      </nav>
      <header className="page-head">
        <div>
          <h1 className="title">{isOffice ? "Office documents" : `${course!.id} ${course!.title}`}</h1>
          <p className="subtitle">
            {isOffice
              ? "Guides, checklists and templates that belong to the office and not to one course."
              : `${course!.term}. Coordinated by ${name(course!.coordinator)}.`}
          </p>
        </div>
        <div className="row">
          {!isAdmin && <ScopeSwitch scope={scope} setScope={setScope} />}
          <Link className="btn primary" to={`/cabinet/file?course=${courseId}`}>
            File a document
          </Link>
        </div>
      </header>

      <div className="chips" role="group" aria-label="Filter by kind">
        <button className="chip" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
          All kinds
        </button>
        {kindsHere.map((k) => (
          <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <section style={{ marginTop: "var(--space-5)" }}>
        <div className="chapter">
          <div>
            <p className="num">{isOffice ? "Office" : "Whole course"}</p>
            <h2 className="h3">{isOffice ? "Guides and templates" : "Syllabus and textbook"}</h2>
          </div>
          <div className="doclist">{rows(null, isOffice ? [] : ["syllabus"])}</div>
        </div>
        {course?.chapters.map((ch) => (
          <div className="chapter" key={ch.number}>
            <div>
              <p className="num">Chapter {ch.number}</p>
              <h2 className="h3">{ch.title}</h2>
            </div>
            <div className="doclist">{rows(ch.number, REQUIRED)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
