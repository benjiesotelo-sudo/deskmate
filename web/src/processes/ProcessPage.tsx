import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PersonChip } from "../avatars/PersonChip";
import { participants, personById, useOffice, type OfficeData } from "./api";
import { ArrowIcon, BackIcon, DocIcon, NextIcon, PauseIcon, PlayIcon, RestartIcon } from "./icons";
import { readingOrder } from "./layout";
import { links } from "./links";
import { usePlayback, type Playback } from "./playback";
import { ProcessEditor } from "./ProcessEditor";
import { ProcessFlow } from "./ProcessFlow";
import { KIND_LABEL, type OfficeProcess, type ProcessStep } from "./types";
import "./processes.css";

type View = "flow" | "steps" | "edit";
const VIEWS: Array<{ id: View; label: string }> = [
  { id: "flow", label: "Flow" },
  { id: "steps", label: "Steps" },
  { id: "edit", label: "Edit" },
];

export function ProcessPage() {
  const { id = "" } = useParams();
  const office = useOffice();

  if (office.status === "loading") return <PageNote>Loading the process...</PageNote>;
  if (office.status === "error") return <PageNote tone="error">{office.error}</PageNote>;
  const process = office.data.processes.find((item) => item.id === id);
  if (!process) {
    return (
      <PageNote tone="error">
        There is no documented process called "{id}". <Link to={links.processes()}>See every process</Link>
      </PageNote>
    );
  }
  return <ProcessView key={process.id} process={process} data={office.data} />;
}

export function PageNote({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="dm-page">
      <p className={`dm-note${tone === "error" ? " dm-note-error" : ""}`} role={tone === "error" ? "alert" : "status"}>
        {children}
      </p>
    </div>
  );
}

function ProcessView({ process, data }: { process: OfficeProcess; data: OfficeData }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const view: View = requested === "steps" || requested === "edit" ? requested : "flow";
  const setView = (next: View) => {
    const copy = new URLSearchParams(params);
    if (next === "flow") copy.delete("view");
    else copy.set("view", next);
    setParams(copy, { replace: true });
  };

  const playback = usePlayback(process);
  const ordered = useMemo(() => readingOrder(process), [process]);
  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.id ?? null);

  // The side panel follows the step being played.
  useEffect(() => {
    if (playback.stepId) setSelectedId(playback.stepId);
  }, [playback.stepId]);

  const { visited, walked } = useMemo(() => {
    const seen = new Set<string>();
    const edges = new Set<string>();
    for (let i = 0; i <= playback.index; i += 1) {
      const id = playback.run[i];
      if (!id) continue;
      seen.add(id);
      const before = playback.run[i - 1];
      if (i > 0 && before) edges.add(`${before}>${id}`);
    }
    return { visited: seen, walked: edges };
  }, [playback.index, playback.run]);

  // Space and the arrow keys drive playback, unless the reader is typing or on a control.
  useEffect(() => {
    if (view !== "flow") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName)) return;
      if (event.key === " ") {
        event.preventDefault();
        playback.toggle();
      } else if (event.key === "ArrowRight") playback.next();
      else if (event.key === "ArrowLeft") playback.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, playback]);

  const owner = personById(data.people, process.owner);
  const selected = process.steps.find((step) => step.id === selectedId) ?? null;
  const people = participants(process);
  const isLocal = data.localEdits.includes(process.id);

  return (
    <div className="dm-page">
      <nav className="dm-crumbs" aria-label="Breadcrumb">
        <Link to={links.office()}>Office</Link>
        <span aria-hidden="true">/</span>
        <Link to={links.processes()}>Processes</Link>
      </nav>

      <header className="proc-head">
        <div className="proc-head-text">
          <h1>{process.name}</h1>
          <p className="proc-summary">{process.summary}</p>
          <dl className="proc-facts">
            <div>
              <dt>Owner</dt>
              <dd>
                <PersonChip person={owner} fallbackId={process.owner} />
              </dd>
            </div>
            <div>
              <dt>Starts when</dt>
              <dd>{process.trigger}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {process.steps.length} steps, {people.length} {people.length === 1 ? "person" : "people"}
              </dd>
            </div>
          </dl>
        </div>
        <Link className="dm-button dm-button-accent" to={links.officePlay(process.id)}>
          <PlayIcon size={16} /> Play it in the office
        </Link>
      </header>

      <aside className="proc-example">
        <span className="dm-eyebrow">A real example</span>
        <p>{process.example}</p>
      </aside>

      {isLocal ? (
        <p className="dm-note">This process has edits that are saved in this browser only. Open Edit to keep or discard them.</p>
      ) : null}

      <div className="dm-tabs" role="tablist" aria-label="Ways to read this process">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={view === item.id}
            aria-controls={`panel-${item.id}`}
            className={`dm-tab${view === item.id ? " is-current" : ""}`}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "flow" ? (
        <section className="proc-flow" role="tabpanel" id="panel-flow" aria-labelledby="tab-flow">
          <div className="dm-stage proc-stage">
            <PlaybackBar playback={playback} process={process} />
            <ProcessFlow
              process={process}
              people={data.people}
              selectedId={selectedId}
              onSelect={setSelectedId}
              activeId={playback.stepId}
              visited={visited}
              walked={walked}
            />
            <p className="proc-legend">
              <span className="legend-item legend-circle">Start and end</span>
              <span className="legend-item legend-task">Task</span>
              <span className="legend-item legend-diamond">Decision</span>
              <span className="legend-item legend-doc">
                <DocIcon size={13} /> Has a document
              </span>
            </p>
          </div>
          <StepPanel step={selected} process={process} data={data} onSelect={setSelectedId} />
        </section>
      ) : null}

      {view === "steps" ? (
        <section role="tabpanel" id="panel-steps" aria-labelledby="tab-steps">
          <StepChecklist process={process} ordered={ordered} data={data} />
        </section>
      ) : null}

      {view === "edit" ? (
        <section role="tabpanel" id="panel-edit" aria-labelledby="tab-edit">
          <ProcessEditor process={process} data={data} />
        </section>
      ) : null}
    </div>
  );
}

function PlaybackBar({ playback, process }: { playback: Playback; process: OfficeProcess }) {
  const started = playback.index >= 0;
  const step = process.steps.find((item) => item.id === playback.stepId);
  return (
    <div className="play-bar">
      <div className="play-buttons">
        <button type="button" className="dm-button dm-button-accent" onClick={playback.toggle}>
          {playback.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          {playback.playing ? "Pause" : playback.finished ? "Play again" : started ? "Resume" : "Play"}
        </button>
        <button type="button" className="dm-icon-button" onClick={playback.back} disabled={playback.index <= 0} aria-label="Previous step" title="Previous step">
          <BackIcon size={16} />
        </button>
        <button type="button" className="dm-icon-button" onClick={playback.next} disabled={playback.finished} aria-label="Next step" title="Next step">
          <NextIcon size={16} />
        </button>
        <button type="button" className="dm-icon-button" onClick={playback.stop} disabled={!started} aria-label="Reset" title="Reset">
          <RestartIcon size={16} />
        </button>
      </div>
      <p className="play-status" aria-live="polite">
        {started && step ? (
          <>
            <strong>
              Step {playback.index + 1} of {playback.run.length}
            </strong>
            <span>{step.title}</span>
          </>
        ) : (
          <span>Press Play to walk through one real run, or pick any step.</span>
        )}
      </p>
    </div>
  );
}

function StepPanel({
  step,
  process,
  data,
  onSelect,
}: {
  step: ProcessStep | null;
  process: OfficeProcess;
  data: OfficeData;
  onSelect: (id: string) => void;
}) {
  if (!step) {
    return (
      <aside className="dm-card step-panel">
        <p className="dm-muted">Pick a step to see who does it and a real example.</p>
      </aside>
    );
  }
  const actor = personById(data.people, step.actor);
  const nextSteps = step.next.map((id) => process.steps.find((item) => item.id === id)).filter((item): item is ProcessStep => Boolean(item));
  return (
    <aside className="dm-card step-panel" aria-live="polite">
      <span className={`dm-chip kind-${step.kind}`}>{KIND_LABEL[step.kind]}</span>
      <h2>{step.title}</h2>
      <div className="step-actor">
        <PersonChip person={actor} fallbackId={step.actor} size={34} showRole />
      </div>
      {step.description ? <p className="step-description">{step.description}</p> : null}
      {step.example ? (
        <div className="step-example">
          <span className="dm-eyebrow">For example</span>
          <p>{step.example}</p>
        </div>
      ) : null}
      {step.artifact ? <ArtifactLink docId={step.artifact} data={data} /> : null}
      {nextSteps.length > 0 ? (
        <div className="step-next">
          <span className="dm-eyebrow">{step.kind === "decision" ? "Then one of" : "Then"}</span>
          <ul>
            {nextSteps.map((next) => (
              <li key={next.id}>
                <button type="button" className="dm-link-button" onClick={() => onSelect(next.id)}>
                  <ArrowIcon size={14} /> {next.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

export function ArtifactLink({ docId, data }: { docId: string; data: OfficeData }) {
  return (
    <Link className="artifact-link" to={links.document(docId)}>
      <DocIcon size={16} />
      <span>
        <span className="dm-eyebrow">Document</span>
        <span className="artifact-name">{data.documentTitles[docId] ?? docId}</span>
      </span>
    </Link>
  );
}

function StepChecklist({ process, ordered, data }: { process: OfficeProcess; ordered: ProcessStep[]; data: OfficeData }) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const numberOf = new Map(ordered.map((step, index) => [step.id, index + 1]));
  const toggle = (id: string) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="dm-card checklist">
      <p className="dm-muted checklist-intro">
        The same process as a plain list. Tick steps off as you go - ticks are only for you and are not saved.
        {done.size > 0 ? ` ${done.size} of ${ordered.length} done.` : ""}
      </p>
      <ol>
        {ordered.map((step) => {
          const actor = personById(data.people, step.actor);
          const nextSteps = step.next.filter((id) => numberOf.has(id));
          const inputId = `check-${process.id}-${step.id}`;
          return (
            <li key={step.id} className={done.has(step.id) ? "is-done" : ""}>
              <div className="check-row">
                <input id={inputId} type="checkbox" checked={done.has(step.id)} onChange={() => toggle(step.id)} />
                <label htmlFor={inputId} className="check-title">
                  {step.title}
                </label>
                <span className={`dm-chip kind-${step.kind}`}>{KIND_LABEL[step.kind]}</span>
              </div>
              <div className="check-body">
                <PersonChip person={actor} fallbackId={step.actor} size={24} showRole />
                {step.description ? <p>{step.description}</p> : null}
                {step.example ? (
                  <p className="check-example">
                    <span className="dm-eyebrow">For example</span> {step.example}
                  </p>
                ) : null}
                {step.artifact ? <ArtifactLink docId={step.artifact} data={data} /> : null}
                {nextSteps.length > 0 ? (
                  <p className="check-next">
                    {step.kind === "decision" ? "Then, depending on the answer: " : "Then: "}
                    {nextSteps.map((id, index) => (
                      <span key={id}>
                        {index > 0 ? " or " : ""}
                        step {numberOf.get(id)}, {process.steps.find((item) => item.id === id)?.title}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
