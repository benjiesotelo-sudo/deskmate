import { Link } from "react-router-dom";
import { AvatarHead } from "../avatars/Avatar.tsx";
import { PersonChip } from "../avatars/PersonChip.tsx";
import { participants, personById, useOffice } from "./api.ts";
import { FlowIcon, PlayIcon } from "./icons.tsx";
import { links } from "./links.ts";
import { PageNote } from "./ProcessPage.tsx";
import "../styles/tokens.css";
import "./processes.css";

// /processes: every documented process of the office, one card each.
export function ProcessListPage() {
  const office = useOffice();
  if (office.status === "loading") return <PageNote>Loading the processes...</PageNote>;
  if (office.status === "error") return <PageNote tone="error">{office.error}</PageNote>;
  const { people, processes } = office.data;

  return (
    <main className="dm-page">
      <nav className="dm-crumbs" aria-label="Breadcrumb">
        <Link to={links.office()}>Office</Link>
      </nav>
      <header className="proc-head">
        <div className="proc-head-text">
          <h1>How this office works</h1>
          <p className="proc-summary">
            {processes.length === 0
              ? "No process has been documented yet."
              : `${processes.length} documented ${processes.length === 1 ? "process" : "processes"}, each with a real example. Open one to see the flow, or play it in the office.`}
          </p>
        </div>
      </header>
      <ul className="proc-list">
        {processes.map((process) => {
          const ids = participants(process);
          return (
            <li key={process.id} className="dm-card proc-card">
              <h2>
                <Link to={links.process(process.id)}>{process.name}</Link>
              </h2>
              <p>{process.summary}</p>
              <p className="proc-card-trigger">
                <span className="dm-eyebrow">Starts when</span> {process.trigger}
              </p>
              <div className="proc-card-foot">
                <PersonChip person={personById(people, process.owner)} fallbackId={process.owner} />
                <span className="proc-card-count">{process.steps.length} steps</span>
                <span className="head-row" aria-label={`${ids.length} people take part`}>
                  {ids.map((id) => {
                    const person = personById(people, id);
                    return (
                      <span key={id} title={person?.name ?? id}>
                        <AvatarHead avatar={person?.avatar} seed={id} size={24} />
                      </span>
                    );
                  })}
                </span>
              </div>
              <div className="proc-card-actions">
                <Link className="dm-button" to={links.process(process.id)}>
                  <FlowIcon size={16} /> Open the flow
                </Link>
                <Link className="dm-button dm-button-accent" to={links.officePlay(process.id)}>
                  <PlayIcon size={16} /> Play in the office
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
