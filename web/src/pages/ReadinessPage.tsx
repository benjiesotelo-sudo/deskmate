import { Link } from "react-router-dom";
import { api, fileLink, KIND_LABEL, type CourseReadiness, type Person, type Readiness, type Slot } from "../lib/api";
import { useSession } from "../lib/session";
import { useLoad } from "../lib/useLoad";

const REASON: Record<string, string> = {
  missing: "nothing is filed",
  draft: "only a draft is filed",
  superseded: "only a superseded version is filed",
};

function slotName(slot: Slot): string {
  return slot.chapter === null ? `${slot.course} syllabus` : `${slot.course} Chapter ${slot.chapter} ${KIND_LABEL[slot.kind].toLowerCase()}`;
}

function Mark({ slot }: { slot: Slot }) {
  if (slot.state === "current") {
    return (
      <Link to={`/documents/${slot.docId}`} className="pill current" title="Open the current document">
        v{slot.version}
      </Link>
    );
  }
  if (slot.state === "missing") {
    return (
      <Link to={fileLink(slot)} className="pill missing" title="File it">
        Missing
      </Link>
    );
  }
  return (
    <Link to={`/documents/${slot.docId}`} className={`pill ${slot.state}`} title="Open it">
      {slot.state === "draft" ? "Draft" : "Old only"}
    </Link>
  );
}

function CourseCard({ course, coordinator }: { course: CourseReadiness; coordinator: string }) {
  const syllabus = course.slots.find((s) => s.chapter === null)!;
  const chapters = [...new Set(course.slots.filter((s) => s.chapter !== null).map((s) => s.chapter as number))];
  return (
    <section className="card stack" id={course.id}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow">{coordinator}</p>
          <h2 className="h2">
            <Link to={`/cabinet/${course.id}`} style={{ textDecoration: "none" }}>
              {course.id}
            </Link>
          </h2>
          <p className="muted">{course.title}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p className="big-number">
            {course.score}
            <small>%</small>
          </p>
          <p className="small muted">
            {course.present} of {course.required} current
          </p>
        </div>
      </div>
      <div className={`meter ${course.score === 100 ? "full" : ""}`}>
        <span style={{ width: `${course.score}%` }} />
      </div>

      <table className="checkgrid">
        <thead>
          <tr>
            <th>Required</th>
            <th>Deck</th>
            <th>Materials</th>
            <th>Quiz</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Syllabus</td>
            <td colSpan={3}>
              <Mark slot={syllabus} />
            </td>
          </tr>
          {chapters.map((n) => {
            const of = (kind: string) => course.slots.find((s) => s.chapter === n && s.kind === kind)!;
            return (
              <tr key={n}>
                <td>
                  Ch {n} - {of("deck").chapterTitle}
                </td>
                <td>
                  <Mark slot={of("deck")} />
                </td>
                <td>
                  <Mark slot={of("materials")} />
                </td>
                <td>
                  <Mark slot={of("quiz")} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {course.gaps.length === 0 ? (
        <p className="notice ok">Every required document is filed and current. Nothing to chase.</p>
      ) : (
        <div>
          <p className="label" style={{ marginBottom: "var(--space-2)" }}>
            {course.gaps.length} {course.gaps.length === 1 ? "gap" : "gaps"} to close
          </p>
          <ul className="gaplist">
            {course.gaps.map((gap) => (
              <li key={`${gap.chapter}-${gap.kind}`} className={gap.state}>
                <span>
                  <strong>{slotName(gap)}</strong> - {REASON[gap.state]}
                </span>
                {gap.state === "missing" ? <Link to={fileLink(gap)}>File it</Link> : <Link to={`/documents/${gap.docId}`}>Open it</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {course.slots.some((s) => s.duplicates.length > 1) && (
        <p className="notice error">More than one document is marked current in the same slot. Open the course and mark the older one superseded.</p>
      )}
    </section>
  );
}

export function ReadinessPage() {
  const { me, office } = useSession();
  const { data, error } = useLoad(async () => {
    const [readiness, people] = await Promise.all([api<Readiness>("/api/readiness"), api<Person[]>("/api/people")]);
    return { readiness, people };
  }, []);

  if (error) return <div className="page"><p className="notice error">{error}</p></div>;
  if (!data) return <div className="page" />;

  const { readiness, people } = data;
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const isAdmin = me?.access === "admin";
  const mine = readiness.courses.filter((c) => c.coordinator === me?.id);
  const rest = readiness.courses.filter((c) => c.coordinator !== me?.id);
  // A coordinator's hero number is their own courses. An admin's is the whole office.
  const focus = !isAdmin && mine.length ? mine : readiness.courses;
  const present = focus.reduce((n, c) => n + c.present, 0);
  const required = focus.reduce((n, c) => n + c.required, 0);
  const score = required ? Math.round((present / required) * 100) : 100;
  const gaps = required - present;
  const scoped = !isAdmin && mine.length > 0;

  return (
    <div className="page">
      <p className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>
        Accreditation readiness - {office?.term}
      </p>
      <header className="hero">
        <p className="hero-number" aria-label={`${score} percent ready`}>
          {score}
          <sup>%</sup>
        </p>
        <div className="hero-copy">
          <h1 className="h2">
            {present} of {required} required documents are filed and current{scoped ? " in your courses" : ""}.
          </h1>
          <p className="subtitle">
            {gaps === 0
              ? "Nothing is missing. The office is ready to be visited."
              : `${gaps} ${gaps === 1 ? "gap is" : "gaps are"} named below, each with a link to close it.`}{" "}
            This is plain counting, not AI: a syllabus per course, and a deck, materials and a quiz per chapter.
          </p>
        </div>
      </header>

      <div className="grid cols-2 section" style={{ alignItems: "start" }}>
        {(scoped ? mine : readiness.courses).map((c) => (
          <CourseCard key={c.id} course={c} coordinator={`Coordinator: ${name(c.coordinator)}`} />
        ))}
      </div>

      {scoped && rest.length > 0 && (
        <section className="section">
          <h2 className="h3">The rest of the office</h2>
          <p className="muted" style={{ marginBottom: "var(--space-4)" }}>
            Courses you do not coordinate, shown for reference.
          </p>
          <div className="grid cols-2" style={{ alignItems: "start" }}>
            {rest.map((c) => (
              <CourseCard key={c.id} course={c} coordinator={`Coordinator: ${name(c.coordinator)}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
