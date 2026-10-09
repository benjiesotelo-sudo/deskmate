import type { KeyboardEvent, ReactNode } from "react";
import { AvatarFigure } from "../avatars/Avatar.tsx";
import { TamsFigure } from "../avatars/Tams.tsx";
import { OUTLINE } from "../avatars/tokens.ts";
import { firstName } from "../processes/api.ts";
import type { Person } from "../processes/types.ts";
import { FRONT_DESK, HOME, placeDesks, placeHome, ROOM, SCENE, type Point } from "./layout.ts";

export type SceneSelection = { kind: "person"; id: string } | { kind: "tams" } | null;

type Props = {
  people: Person[];
  selection: SceneSelection;
  onSelect: (selection: SceneSelection) => void;
  // playback
  activeId?: string | null; // whose turn it is
  previousId?: string | null; // who had the step before
  stepKey?: number; // changes on every step so one-shot animations replay
  involved?: ReadonlySet<string> | null; // people in the process being played
  hasDocument?: boolean;
  tamsTalking?: boolean;
};

const LINE = { stroke: OUTLINE, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const AVATAR_SCALE = 1.2;

function pressable(action: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: action,
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
      }
    },
  };
}

function Seated({ person, at }: { person: Person; at: Point }) {
  return (
    <g transform={`translate(${at.x - 32 * AVATAR_SCALE} ${at.y - 92}) scale(${AVATAR_SCALE})`}>
      <AvatarFigure avatar={person.avatar} seed={person.id} shadow={false} />
    </g>
  );
}

function NameTag({ at, text, dy, away = false }: { at: Point; text: string; dy: number; away?: boolean }) {
  const width = Math.max(58, text.length * 9.4 + 26);
  return (
    <g className={`name-tag${away ? " is-away" : ""}`} transform={`translate(${at.x} ${at.y + dy})`}>
      <rect x={-width / 2} y={-13} width={width} height={26} rx={13} />
      <text textAnchor="middle" y={5.5}>
        {text}
      </text>
    </g>
  );
}

function Desk({ at, away, children }: { at: Point; away: boolean; children?: ReactNode }) {
  return (
    <g>
      <ellipse className="desk-glow" cx={at.x} cy={at.y + 10} rx={96} ry={50} />
      <rect x={at.x - 21} y={at.y - 56} width={42} height={46} rx={12} fill="#39446e" {...LINE} />
      {children}
      <rect className="desk-front" x={at.x - 64} y={at.y + 6} width={128} height={34} rx={9} fill="#b98a57" {...LINE} />
      <rect className="desk-top" x={at.x - 66} y={at.y - 16} width={132} height={38} rx={10} fill="#e6c08d" {...LINE} />
      {away ? (
        <g transform={`translate(${at.x} ${at.y + 3})`} className="away-card">
          <rect x={-22} y={-13} width={44} height={26} rx={6} />
          <path d="M-9 1 L0 -7 L9 1 M-6.5 0 V8 H6.5 V0" fill="none" />
        </g>
      ) : (
        <g>
          <rect x={at.x + 6} y={at.y - 22} width={42} height={27} rx={5} fill="#414b63" {...LINE} strokeWidth={2.6} />
          <circle cx={at.x + 27} cy={at.y - 8.5} r={3.2} fill="#f4a62a" />
          <rect x={at.x - 52} y={at.y - 8} width={30} height={20} rx={3} fill="#fffaf0" {...LINE} strokeWidth={2.2} />
          <path d={`M${at.x - 46} ${at.y - 2} h18 M${at.x - 46} ${at.y + 4} h12`} fill="none" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="30" rx="22" ry="5" fill="rgba(0,0,0,0.25)" />
      <path d="M0 6 C-26 -6 -28 -34 -10 -40 C-4 -28 0 -14 0 6 Z" fill="#4c9a6a" {...LINE} />
      <path d="M0 6 C26 -6 28 -34 10 -40 C4 -28 0 -14 0 6 Z" fill="#3b8259" {...LINE} />
      <path d="M0 8 C-8 -18 -6 -42 0 -52 C6 -42 8 -18 0 8 Z" fill="#62b381" {...LINE} />
      <path d="M-16 4 H16 L12 30 H-12 Z" fill="#c9764f" {...LINE} />
    </g>
  );
}

// The top-down office. Everything is plain SVG; motion is CSS transforms only.
export function OfficeScene({
  people,
  selection,
  onSelect,
  activeId = null,
  previousId = null,
  stepKey = 0,
  involved = null,
  hasDocument = false,
  tamsTalking = false,
}: Props) {
  const desks = placeDesks(people);
  const homes = placeHome(people);
  // The marker floats just above the head, so it reads as "this person has the work now".
  const markerOf = (id: string | null): Point | undefined => {
    const person = people.find((item) => item.id === id);
    if (!person) return undefined;
    const home = homes.get(person.id);
    const desk = desks.get(person.id);
    if (person.location === "home") return home ? { x: home.x - 12, y: home.y - 100 } : undefined;
    return desk ? { x: desk.x, y: desk.y - 104 } : undefined;
  };
  const here = markerOf(activeId);
  const before = markerOf(previousId);
  const playing = activeId !== null;
  const atHome = people.filter((person) => person.location === "home");
  // Draw back rows first so nearer desks overlap the ones behind them.
  const byDepth = [...people].sort((a, b) => (desks.get(a.id)?.y ?? 0) - (desks.get(b.id)?.y ?? 0));
  const classFor = (id: string, base: string) =>
    [
      base,
      id === activeId ? "is-active" : "",
      playing && involved && !involved.has(id) ? "is-dim" : "",
      selection?.kind === "person" && selection.id === id ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <svg className="office-scene" viewBox={`0 0 ${SCENE.width} ${SCENE.height}`} role="group" aria-label="The office, seen from above">
      <defs>
        <pattern id="office-tiles" width="76" height="76" patternUnits="userSpaceOnUse">
          <path d="M76 0 H0 V76" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="2" />
        </pattern>
      </defs>

      {/* the room */}
      <rect x={ROOM.x} y={ROOM.y} width={ROOM.width} height={ROOM.height} rx="30" fill="var(--stage-raised, #263058)" />
      <rect x={ROOM.x} y={ROOM.y} width={ROOM.width} height={ROOM.height} rx="30" fill="url(#office-tiles)" />
      <rect x={ROOM.x} y={ROOM.y} width={ROOM.width} height={ROOM.height} rx="30" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
      {/* doorway in the left wall, beside the front desk */}
      <rect x={ROOM.x - 5} y={ROOM.y + 470} width="10" height="66" fill="var(--stage, #1b2340)" />
      {/* back wall: whiteboard, cabinet, plants */}
      <g>
        <rect x="372" y="34" width="250" height="62" rx="8" fill="#fffaf0" {...LINE} />
        <path d="M392 56 h70 M392 72 h46" fill="none" stroke="#2a9d8f" strokeWidth="4" strokeLinecap="round" />
        <path d="M494 80 l22 -22 l18 12 l28 -30 l22 16" fill="none" stroke="#ef6f55" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="474" y="96" width="46" height="7" rx="3.5" fill="#8d96a8" stroke={OUTLINE} strokeWidth="2" />
      </g>
      <g>
        <rect x="52" y="40" width="74" height="92" rx="8" fill="#8d96a8" {...LINE} />
        <path d="M52 71 H126 M52 102 H126" fill="none" {...LINE} />
        <path d="M78 55 h22 M78 86 h22 M78 117 h22" fill="none" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
      </g>
      <Plant x={910} y={84} />

      {/* working from home strip */}
      <g>
        <rect className="home-strip" x={HOME.x} y={HOME.y} width={HOME.width} height={HOME.height} rx="30" />
        <g transform={`translate(${HOME.x + 30} ${HOME.y + 34})`} className="home-title">
          <path d="M0 16 L15 3 L30 16 M4.5 13.5 V30 H25.5 V13.5 M12 30 V21 H18 V30" fill="none" />
          <text x="42" y="15">Working from home</text>
          <text x="42" y="34" className="home-count">
            {atHome.length === 0 ? "Nobody today" : atHome.length === 1 ? "1 person today" : `${atHome.length} people today`}
          </text>
        </g>
      </g>

      {/* desks, back row first */}
      {byDepth.map((person) => {
        const at = desks.get(person.id);
        if (!at) return null;
        const away = person.location === "home";
        const name = firstName(person, person.id);
        if (away) {
          return (
            <g key={person.id} className="desk is-away" aria-hidden="true">
              <Desk at={at} away />
              <NameTag at={at} text={`${name} - at home`} dy={56} away />
            </g>
          );
        }
        return (
          <g key={person.id} className={classFor(person.id, "desk")} aria-label={`${person.name}, ${person.role}, in the office`} {...pressable(() => onSelect({ kind: "person", id: person.id }))}>
            <title>{`${person.name} - ${person.role}`}</title>
            <Desk at={at} away={false}>
              <Seated person={person} at={at} />
            </Desk>
            <NameTag at={at} text={name} dy={56} />
            <rect className="hit" x={at.x - 76} y={at.y - 96} width={152} height={176} rx={18} />
          </g>
        );
      })}

      {/* people at home */}
      {atHome.map((person) => {
        const at = homes.get(person.id);
        if (!at) return null;
        return (
          <g key={person.id} className={classFor(person.id, "desk home-desk")} aria-label={`${person.name}, ${person.role}, working from home`} {...pressable(() => onSelect({ kind: "person", id: person.id }))}>
            <title>{`${person.name} - ${person.role} - working from home`}</title>
            <ellipse className="desk-glow" cx={at.x} cy={at.y + 6} rx={98} ry={56} />
            <path className="home-roof" d={`M${at.x - 84} ${at.y - 64} L${at.x} ${at.y - 108} L${at.x + 84} ${at.y - 64}`} />
            <rect className="home-room" x={at.x - 72} y={at.y - 70} width={144} height={100} rx={14} />
            <rect x={at.x + 30} y={at.y - 58} width={30} height={30} rx={5} fill="#8fc7e8" {...LINE} strokeWidth={2.4} />
            <path d={`M${at.x + 45} ${at.y - 58} v30 M${at.x + 30} ${at.y - 43} h30`} fill="none" stroke={OUTLINE} strokeWidth={2} />
            <Seated person={person} at={{ x: at.x - 12, y: at.y + 6 }} />
            <rect className="desk-top" x={at.x - 58} y={at.y - 8} width={104} height={30} rx={9} fill="#e6c08d" {...LINE} />
            <rect x={at.x - 2} y={at.y - 18} width={36} height={23} rx={5} fill="#414b63" {...LINE} strokeWidth={2.6} />
            <circle cx={at.x + 16} cy={at.y - 6.5} r={2.8} fill="#f4a62a" />
            <NameTag at={at} text={firstName(person, person.id)} dy={50} />
            <rect className="hit" x={at.x - 90} y={at.y - 110} width={180} height={178} rx={18} />
          </g>
        );
      })}

      {/* Tams at the front desk */}
      <g
        className={`tams-desk${selection?.kind === "tams" ? " is-selected" : ""}`}
        aria-label="Tams the bull, at the front desk"
        {...pressable(() => onSelect({ kind: "tams" }))}
      >
        <title>Tams - the office's AI manager</title>
        <ellipse className="desk-glow" cx={FRONT_DESK.x} cy={FRONT_DESK.y + 14} rx={150} ry={56} />
        <g transform={`translate(${FRONT_DESK.x - 71} ${FRONT_DESK.y - 140}) scale(1.18)`}>
          <TamsFigure shadow={false} talking={tamsTalking} />
        </g>
        <rect x={FRONT_DESK.x - 118} y={FRONT_DESK.y + 4} width={236} height={42} rx={12} fill="#a9743f" {...LINE} />
        <rect className="desk-top" x={FRONT_DESK.x - 122} y={FRONT_DESK.y - 22} width={244} height={42} rx={14} fill="#e6c08d" {...LINE} />
        <g transform={`translate(${FRONT_DESK.x} ${FRONT_DESK.y + 26})`} className="front-sign">
          <rect x={-58} y={-12} width={116} height={24} rx={7} />
          <text textAnchor="middle" y={5.5}>
            ASK TAMS
          </text>
        </g>
        <rect className="hit" x={FRONT_DESK.x - 126} y={FRONT_DESK.y - 142} width={252} height={192} rx={18} />
      </g>

      {/* playback: a trail from the last desk and a dot that carries the work */}
      {here ? (
        <g className="travel-layer" aria-hidden="true">
          {before && (before.x !== here.x || before.y !== here.y) ? (
            <path key={`trail-${stepKey}`} className="travel-trail" d={`M${before.x} ${before.y} L${here.x} ${here.y}`} pathLength={1} />
          ) : null}
          <g className="travel" style={{ transform: `translate(${here.x}px, ${here.y}px)` }}>
            <circle key={`ring-${stepKey}`} className="travel-ring" r="13" />
            <circle className="travel-dot" r="11" />
            {hasDocument ? (
              <g key={`doc-${stepKey}`} className="travel-doc">
                <path d="M-7 -42 H3 L9 -36 V-20 H-7 Z" />
                <path d="M3 -42 V-36 H9 M-3 -31 H5 M-3 -26 H5" fill="none" />
              </g>
            ) : null}
          </g>
        </g>
      ) : null}
    </svg>
  );
}
