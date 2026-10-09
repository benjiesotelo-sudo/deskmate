import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PersonChip } from "../avatars/PersonChip";
import { participants, personById, useOffice, type OfficeData } from "../processes/api";
import { BackIcon, CloseIcon, DocIcon, FlowIcon, HouseIcon, NextIcon, PauseIcon, PlayIcon, RestartIcon } from "../processes/icons";
import { links } from "../processes/links";
import { usePlayback, type Playback } from "../processes/playback";
import { PageNote } from "../processes/ProcessPage";
import type { OfficeProcess, Person } from "../processes/types";
import { HowItWorks } from "./HowItWorks";
import { OfficeScene, type SceneSelection } from "./OfficeScene";
import { PersonCard, TamsCard } from "./PersonCard";
import "../processes/processes.css";
import "./office.css";

const QUICK_PLAYS = 4;

// /office - the office seen from above. /office?play=<processId> plays that process in it.
export function OfficePage() {
  const office = useOffice();
  if (office.status === "loading") return <PageNote>Opening the office...</PageNote>;
  if (office.status === "error") return <PageNote tone="error">{office.error}</PageNote>;
  return <OfficeView data={office.data} />;
}

function OfficeView({ data }: { data: OfficeData }) {
  const { people, processes } = data;
  const [params, setParams] = useSearchParams();
  const playId = params.get("play");
  const process = useMemo(() => processes.find((item) => item.id === playId), [processes, playId]);
  const playback = usePlayback(process, { autoStart: true });
  const [selection, setSelection] = useState<SceneSelection>(null);
  const stage = useRef<HTMLDivElement>(null);

  const stopPlaying = () => {
    const copy = new URLSearchParams(params);
    copy.delete("play");
    setParams(copy);
  };

  // Bring the stage into view when a process starts, wherever on the page it was launched from.
  useEffect(() => {
    if (playId) stage.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [playId]);

  // Presenter keys: space to pause or resume, arrows to step, Escape to stop.
  useEffect(() => {
    if (!process) return;
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
  }, [process, playback]);

  const step = process?.steps.find((item) => item.id === playback.stepId);
  const previous = process?.steps.find((item) => item.id === playback.previousStepId);
  const involved = useMemo(() => (process ? new Set(participants(process)) : null), [process]);
  const selected = selection?.kind === "person" ? personById(people, selection.id) : undefined;
  const inOffice = people.filter((person) => person.location !== "home");
  const atHome = people.filter((person) => person.location === "home");

  return (
    <div className="dm-page office-page">
      <header className="proc-head">
        <div className="proc-head-text">
          <h1>The office</h1>
          <p className="proc-summary">
            {inOffice.length} in the office, {atHome.length} working from home. Click anyone to see what they own, or play a process to watch the work move
            from desk to desk.
          </p>
        </div>
        <Link className="dm-button" to={links.processes()}>
          <FlowIcon size={16} /> All processes
        </Link>
      </header>

      <div className="office-grid">
        <div className="dm-stage office-stage" ref={stage}>
          <OfficeScene
            people={people}
            selection={selection}
            onSelect={setSelection}
            activeId={step?.actor ?? null}
            previousId={previous?.actor ?? null}
            stepKey={playback.index}
            involved={step ? involved : null}
            hasDocument={Boolean(step?.artifact)}
            tamsTalking={playback.playing}
          />
          <div className="office-caption" aria-live="polite">
            {playId && !process ? (
              <div className="caption-body">
                <p className="caption-title">There is no documented process called "{playId}".</p>
                <div className="caption-controls">
                  <button type="button" className="dm-button dm-button-small" onClick={stopPlaying}>
                    Back to the office
                  </button>
                </div>
              </div>
            ) : process && step ? (
              <StepCaption process={process} playback={playback} data={data} onClose={stopPlaying} />
            ) : (
              <div className="caption-body">
                <p className="caption-eyebrow">Tams</p>
                <p className="caption-title">Pick a process to watch who does what.</p>
                {processes.length > 0 ? (
                  <div className="caption-chips">
                    {processes.slice(0, QUICK_PLAYS).map((item) => (
                      <Link key={item.id} className="caption-chip" to={links.officePlay(item.id)}>
                        <PlayIcon size={13} /> {item.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="caption-example">No process has been documented yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="office-side">
          {selection?.kind === "tams" ? (
            <TamsCard data={data} onClose={() => setSelection(null)} />
          ) : selected ? (
            <PersonCard key={selected.id} person={selected} data={data} onClose={() => setSelection(null)} />
          ) : (
            <Roster inOffice={inOffice} atHome={atHome} onPick={(id) => setSelection({ kind: "person", id })} />
          )}
        </aside>
      </div>

      <HowItWorks data={data} playingId={process && step ? process.id : null} activeActor={step?.actor ?? null} onPickPerson={(id) => setSelection({ kind: "person", id })} />
    </div>
  );
}

function Roster({ inOffice, atHome, onPick }: { inOffice: Person[]; atHome: Person[]; onPick: (id: string) => void }) {
  const group = (title: string, list: Person[], home: boolean) => (
    <>
      <h3>
        {home ? <HouseIcon size={15} /> : <span className="presence-dot" />} {title} <span className="dm-muted">{list.length}</span>
      </h3>
      {list.length === 0 ? (
        <p className="dm-muted">Nobody today.</p>
      ) : (
        <ul className="roster-list">
          {list.map((person) => (
            <li key={person.id}>
              <button type="button" onClick={() => onPick(person.id)}>
                <PersonChip person={person} size={30} showRole />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  return (
    <section className="dm-card roster" aria-label="Who is working today">
      <h2>Who is working today</h2>
      {group("In the office", inOffice, false)}
      {group("Working from home", atHome, true)}
    </section>
  );
}

function StepCaption({ process, playback, data, onClose }: { process: OfficeProcess; playback: Playback; data: OfficeData; onClose: () => void }) {
  const step = process.steps.find((item) => item.id === playback.stepId);
  if (!step) return null;
  const actor = personById(data.people, step.actor);
  return (
    <div className="caption-body">
      <div className="caption-top">
        <p className="caption-eyebrow">
          <Link to={links.process(process.id)}>{process.name}</Link>
          <span>
            Step {playback.index + 1} of {playback.run.length}
          </span>
        </p>
        <button type="button" className="dm-icon-button caption-close" onClick={onClose} aria-label="Stop and close" title="Stop and close">
          <CloseIcon size={15} />
        </button>
      </div>
      <p className="caption-title" key={playback.index}>
        {step.title}
      </p>
      <div className="caption-who">
        <PersonChip person={actor} fallbackId={step.actor} size={26} tone="stage" />
        {actor ? <span className="caption-role">{actor.location === "home" ? `${actor.role}, working from home` : actor.role}</span> : null}
        {step.artifact ? (
          <Link className="caption-doc" to={links.document(step.artifact)}>
            <DocIcon size={14} /> {data.documentTitles[step.artifact] ?? step.artifact}
          </Link>
        ) : null}
      </div>
      {step.example ? <p className="caption-example">{step.example}</p> : null}
      <div className="caption-controls">
        <button type="button" className="dm-icon-button" onClick={playback.back} disabled={playback.index <= 0} aria-label="Previous step" title="Previous step">
          <BackIcon size={15} />
        </button>
        <button type="button" className="dm-button dm-button-small dm-button-accent" onClick={playback.finished && !playback.playing ? playback.restart : playback.toggle}>
          {playback.playing ? <PauseIcon size={14} /> : playback.finished ? <RestartIcon size={14} /> : <PlayIcon size={14} />}
          {playback.playing ? "Pause" : playback.finished ? "Play again" : "Resume"}
        </button>
        <button type="button" className="dm-icon-button" onClick={playback.next} disabled={playback.finished} aria-label="Next step" title="Next step">
          <NextIcon size={15} />
        </button>
        <ol className="caption-pips" aria-label="Steps">
          {playback.run.map((id, index) => (
            <li key={`${id}-${index}`}>
              <button
                type="button"
                className={index === playback.index ? "is-now" : index < playback.index ? "is-done" : ""}
                onClick={() => playback.goTo(index)}
                aria-label={`Go to step ${index + 1}`}
                aria-current={index === playback.index ? "step" : undefined}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
