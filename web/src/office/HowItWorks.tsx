import { Link } from "react-router-dom";
import { AvatarHead } from "../avatars/Avatar";
import { PersonChip } from "../avatars/PersonChip";
import { firstName, personById, type OfficeData } from "../processes/api";
import { PlayIcon } from "../processes/icons";
import { links } from "../processes/links";

type Props = { data: OfficeData; playingId: string | null; activeActor: string | null; onPickPerson: (id: string) => void };

// "How everything works": every documented process against everyone in the office.
// A filled mark means the person owns it, a number is how many of its steps are theirs.
// Nothing here is typed in by hand - it is all counted from the process data.
export function HowItWorks({ data, playingId, activeActor, onPickPerson }: Props) {
  const { people, processes } = data;
  if (processes.length === 0) {
    return (
      <section className="dm-card how">
        <h2>How everything works</h2>
        <p className="dm-muted">No process has been documented yet.</p>
      </section>
    );
  }
  return (
    <section className="dm-card how" aria-labelledby="how-title">
      <div className="how-head">
        <h2 id="how-title">How everything works</h2>
        <p className="dm-muted">
          {processes.length} documented {processes.length === 1 ? "process" : "processes"} across {people.length} people. A number is how many steps
          that person does.
        </p>
      </div>
      <div className="how-scroll">
        <table className="how-table">
          <thead>
            <tr>
              <th scope="col">Process</th>
              <th scope="col">Owner</th>
              <th scope="col" className="how-num">
                Steps
              </th>
              {people.map((person) => (
                <th key={person.id} scope="col" className="how-person">
                  <button type="button" onClick={() => onPickPerson(person.id)} title={`${person.name} - ${person.role}`}>
                    <AvatarHead avatar={person.avatar} seed={person.id} size={30} />
                    <span>{firstName(person, person.id)}</span>
                  </button>
                </th>
              ))}
              <th scope="col">
                <span className="visually-hidden">Play</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {processes.map((process) => {
              const playing = process.id === playingId;
              return (
                <tr key={process.id} className={playing ? "is-playing" : ""}>
                  <th scope="row">
                    <Link to={links.process(process.id)}>{process.name}</Link>
                    {playing ? <span className="dm-tag dm-tag-accent">playing now</span> : null}
                  </th>
                  <td>
                    <PersonChip person={personById(people, process.owner)} fallbackId={process.owner} size={24} />
                  </td>
                  <td className="how-num">{process.steps.length}</td>
                  {people.map((person) => {
                    const count = process.steps.filter((step) => step.actor === person.id).length;
                    const owner = process.owner === person.id;
                    const label = `${person.name}: ${owner ? "owner" : ""}${owner && count ? ", " : ""}${count ? `${count} steps` : ""}${!owner && !count ? "not involved" : ""}`;
                    return (
                      <td key={person.id} className="how-cell" aria-label={label} title={label}>
                        {count > 0 || owner ? (
                          <span className={`how-mark${owner ? " is-owner" : ""}${playing && activeActor === person.id ? " is-live" : ""}`}>{count > 0 ? count : ""}</span>
                        ) : (
                          <span className="how-none" />
                        )}
                      </td>
                    );
                  })}
                  <td className="how-play">
                    <Link className="dm-button dm-button-small dm-button-accent" to={links.officePlay(process.id)}>
                      <PlayIcon size={14} /> Play
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="how-key">
        <span className="how-mark is-owner" /> owns the process
        <span className="how-mark">2</span> does that many steps
      </p>
    </section>
  );
}
