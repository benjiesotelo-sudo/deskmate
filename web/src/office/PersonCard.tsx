import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../avatars/Avatar";
import { Tams } from "../avatars/Tams";
import { processesOf, type OfficeData } from "../processes/api";
import { ChatIcon, CloseIcon, DocIcon, HouseIcon, PlayIcon } from "../processes/icons";
import { links } from "../processes/links";
import type { Person } from "../processes/types";

const DOCS_SHOWN = 5;

type Props = { person: Person; data: OfficeData; onClose: () => void };

// What one person does here: role, what they own, and every process they appear in.
export function PersonCard({ person, data, onClose }: Props) {
  const [allDocs, setAllDocs] = useState(false);
  const owned = data.processes.filter((process) => process.owner === person.id || person.owns.processes.includes(process.id));
  const takesPart = processesOf(data.processes, person.id);
  const documents = person.owns.documents;
  const shown = allDocs ? documents : documents.slice(0, DOCS_SHOWN);
  const question = `What does ${person.name} (${person.role}) look after in this office, and when should I go to them?`;

  return (
    <section className="dm-card person-card" aria-label={person.name}>
      <button type="button" className="dm-icon-button card-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={16} />
      </button>
      <div className="person-card-top">
        <div className="person-card-avatar">
          <Avatar avatar={person.avatar} seed={person.id} size={84} />
        </div>
        <div>
          <h2>{person.name}</h2>
          <p className="person-role">{person.role}</p>
          <p className={`presence presence-${person.location}`}>
            {person.location === "home" ? <HouseIcon size={14} /> : <span className="presence-dot" />}
            {person.location === "home" ? "Working from home" : "In the office"}
          </p>
        </div>
      </div>
      {person.email ? (
        <a className="person-email" href={`mailto:${person.email}`}>
          {person.email}
        </a>
      ) : null}

      <h3>Owns</h3>
      {owned.length === 0 && documents.length === 0 ? <p className="dm-muted">Nothing is recorded under this name yet.</p> : null}
      {owned.length > 0 ? (
        <ul className="own-list">
          {owned.map((process) => (
            <li key={process.id}>
              <Link to={links.process(process.id)}>{process.name}</Link>
              <span className="dm-tag">process</span>
            </li>
          ))}
        </ul>
      ) : null}
      {documents.length > 0 ? (
        <>
          <ul className="own-list own-docs">
            {shown.map((docId) => (
              <li key={docId}>
                <DocIcon size={14} />
                <Link to={links.document(docId)}>{data.documentTitles[docId] ?? docId}</Link>
              </li>
            ))}
          </ul>
          {documents.length > DOCS_SHOWN ? (
            <button type="button" className="dm-link-button" onClick={() => setAllDocs((value) => !value)}>
              {allDocs ? "Show fewer" : `Show all ${documents.length} documents`}
            </button>
          ) : null}
        </>
      ) : null}

      <h3>Takes part in</h3>
      {takesPart.length === 0 ? (
        <p className="dm-muted">Not in any documented process yet.</p>
      ) : (
        <ul className="part-list">
          {takesPart.map(({ process, owner, steps }) => (
            <li key={process.id}>
              <div>
                <Link to={links.process(process.id)}>{process.name}</Link>
                <span className="dm-muted">
                  {owner ? "Owner" : ""}
                  {owner && steps > 0 ? ", " : ""}
                  {steps > 0 ? `${steps} of ${process.steps.length} steps` : ""}
                </span>
              </div>
              <Link className="dm-icon-button" to={links.officePlay(process.id)} aria-label={`Play ${process.name} in the office`} title="Play in the office">
                <PlayIcon size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link className="dm-button ask-tams" to={links.tams(question)}>
        <ChatIcon size={16} /> Ask Tams about this
      </Link>
    </section>
  );
}

export function TamsCard({ data, onClose }: { data: OfficeData; onClose: () => void }) {
  return (
    <section className="dm-card person-card" aria-label="Tams">
      <button type="button" className="dm-icon-button card-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={16} />
      </button>
      <div className="person-card-top">
        <div className="person-card-avatar">
          <Tams size={92} />
        </div>
        <div>
          <h2>Tams</h2>
          <p className="person-role">The office's AI manager</p>
          <p className="presence presence-office">
            <span className="presence-dot" />
            At the front desk
          </p>
        </div>
      </div>
      <p>
        Ask Tams how to do something here. When the task is one of the {data.processes.length} documented{" "}
        {data.processes.length === 1 ? "process" : "processes"}, he answers with its steps and can play it in this office.
      </p>
      <Link className="dm-button dm-button-accent ask-tams" to="/tams">
        <ChatIcon size={16} /> Ask Tams
      </Link>
    </section>
  );
}
