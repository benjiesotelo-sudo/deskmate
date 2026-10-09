import { OUTLINE } from "./tokens.ts";
import "./avatars.css";

// Tams the bull: Deskmate's mascot and AI manager. An original drawing in the same chibi
// language as the people, but bigger, with the short swept-back horns of a tamaraw.

const STROKE = { stroke: OUTLINE, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const THIN = { ...STROKE, strokeWidth: 2.2 } as const;
const HIDE = "#6f4a33";
const HIDE_DARK = "#4d3122";
const HORN = "#f3e6c2";
const MUZZLE = "#e6c9a8";
const HOOF = "#2c221d";

type FigureProps = { idle?: boolean; shadow?: boolean; talking?: boolean };

// The drawing in a 120 x 128 box, as a <g> so it can sit inside the office scene.
export function TamsFigure({ idle = true, shadow = true, talking = false }: FigureProps) {
  return (
    <g className={`tams${idle ? " tams-idle" : ""}${talking ? " tams-talking" : ""}`}>
      {shadow ? <ellipse cx="60" cy="121" rx="34" ry="6" fill="rgba(0,0,0,0.3)" /> : null}
      <g className="tams-tail">
        <path d="M82 98 C97 95 101 82 97 73" fill="none" stroke={OUTLINE} strokeWidth="7.5" strokeLinecap="round" />
        <path d="M82 98 C97 95 101 82 97 73" fill="none" stroke={HIDE} strokeWidth="3.4" strokeLinecap="round" />
        <ellipse cx="96.5" cy="69.5" rx="4.6" ry="6.6" fill={HIDE_DARK} {...THIN} />
      </g>
      <g className="tams-body">
        <rect x="44" y="99" width="12.5" height="17" rx="4" fill={HIDE} {...STROKE} />
        <rect x="63.5" y="99" width="12.5" height="17" rx="4" fill={HIDE} {...STROKE} />
        <rect x="42.5" y="110.5" width="15.5" height="8.5" rx="3.4" fill={HOOF} {...THIN} />
        <rect x="62" y="110.5" width="15.5" height="8.5" rx="3.4" fill={HOOF} {...THIN} />
        <rect x="26" y="76" width="12.5" height="23" rx="6" fill={HIDE} {...STROKE} transform="rotate(11 32 76)" />
        <rect x="81.5" y="76" width="12.5" height="23" rx="6" fill={HIDE} {...STROKE} transform="rotate(-11 88 76)" />
        <rect x="22.6" y="93" width="12.6" height="8.4" rx="3.6" fill={HOOF} {...THIN} transform="rotate(11 32 76)" />
        <rect x="84.8" y="93" width="12.6" height="8.4" rx="3.6" fill={HOOF} {...THIN} transform="rotate(-11 88 76)" />
        <path d="M37 76 Q60 65 83 76 L87 104 Q60 111 33 104 Z" fill={HIDE} {...STROKE} />
        <path d="M48.5 71.5 L60 95 L71.5 71.5 Q60 76 48.5 71.5 Z" fill="#fffaf0" {...THIN} />
        <path d="M60 76 L56 80.5 L60 98 L64 80.5 Z" fill="#f4a62a" {...THIN} />
        <path d="M48.5 71.5 L57 79 L50 82.5 Z M71.5 71.5 L63 79 L70 82.5 Z" fill="#fffaf0" {...THIN} />
        <g className="tams-head">
          <path d="M38 23 C29 21 21 12 21.5 0.5 C30 4 41 10 47 19 Z" fill={HORN} {...STROKE} />
          <path d="M82 23 C91 21 99 12 98.5 0.5 C90 4 79 10 73 19 Z" fill={HORN} {...STROKE} />
          <path d="M25 9 q3 6 9 9 M95 9 q-3 6 -9 9" fill="none" stroke="#d9c594" strokeWidth="1.8" strokeLinecap="round" />
          <g className="tams-ear tams-ear-left">
            <path d="M27 44 C12 37 5 45 7.5 52.5 C14 55 23 53 30 50 Z" fill={HIDE} {...STROKE} />
            <path d="M23 46.2 C15 43 11.5 47 12.5 50.2 C16.5 51.2 21 50.4 24.5 49 Z" fill="#e79a8c" />
          </g>
          <g className="tams-ear tams-ear-right">
            <path d="M93 44 C108 37 115 45 112.5 52.5 C106 55 97 53 90 50 Z" fill={HIDE} {...STROKE} />
            <path d="M97 46.2 C105 43 108.5 47 107.5 50.2 C103.5 51.2 99 50.4 95.5 49 Z" fill="#e79a8c" />
          </g>
          <rect x="24" y="17" width="72" height="59" rx="28" ry="27" fill={HIDE} {...STROKE} />
          <path d="M49 21 Q54 9 60 18 Q66 9 71 21 Q60 26 49 21 Z" fill={HIDE_DARK} {...THIN} />
          <ellipse cx="34" cy="52" rx="5" ry="3" fill="#ef7f6d" opacity="0.4" />
          <ellipse cx="86" cy="52" rx="5" ry="3" fill="#ef7f6d" opacity="0.4" />
          <ellipse cx="60" cy="60" rx="24.5" ry="15.5" fill={MUZZLE} {...STROKE} />
          <ellipse cx="51.5" cy="56.5" rx="2.6" ry="3.5" fill={HOOF} />
          <ellipse cx="68.5" cy="56.5" rx="2.6" ry="3.5" fill={HOOF} />
          <path className="tams-mouth" d="M51.5 65.5 Q60 72.5 68.5 65.5" fill="none" {...THIN} />
          <path d="M36.5 33.5 Q43 30 49.5 33.5 M70.5 33.5 Q77 30 83.5 33.5" fill="none" {...STROKE} />
          <g className="tams-eyes">
            <ellipse cx="43.5" cy="42.5" rx="4.1" ry="5.6" fill={OUTLINE} />
            <ellipse cx="76.5" cy="42.5" rx="4.1" ry="5.6" fill={OUTLINE} />
            <circle cx="45" cy="40.4" r="1.6" fill="#ffffff" />
            <circle cx="78" cy="40.4" r="1.6" fill="#ffffff" />
          </g>
        </g>
      </g>
    </g>
  );
}

type Props = { size?: number; idle?: boolean; talking?: boolean; title?: string; className?: string };

export function Tams({ size = 120, idle = true, talking = false, title = "Tams the bull", className }: Props) {
  return (
    <svg className={className} viewBox="0 -4 120 132" width={size} height={(size * 132) / 120} role="img" aria-label={title}>
      <TamsFigure idle={idle} talking={talking} />
    </svg>
  );
}

export function TamsHead({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="2 -4 116 86" width={size} height={(size * 86) / 116} aria-hidden="true">
      <TamsFigure idle={false} shadow={false} />
    </svg>
  );
}
