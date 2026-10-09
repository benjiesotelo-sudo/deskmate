import type { CSSProperties, ReactNode } from "react";
import { OUTLINE, phase, resolveLook, shade, type AvatarLook, type AvatarTokens } from "./tokens";
import "./avatars.css";

// Chibi office avatars: big head, small body, bold outline, flat colours.
// Every drawing here is original and composed from the `avatar` tokens of a person.

const STROKE = { stroke: OUTLINE, strokeWidth: 2.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const THIN = { ...STROKE, strokeWidth: 1.7 } as const;
const FRINGE: Record<string, string> = {
  short:
    "M10.5 27 C9 11 20 6.5 32 6.5 C44 6.5 55 11 53.5 27 C50 21 46 17.5 40 17 C36 19.5 26 20 20 17.5 C15 19 12 22 10.5 27 Z",
  quiff:
    "M10.5 27 C9 12 19 7 30 7 C34 2 46 2.5 49 8 C53 12 54.5 19 53.5 27 C51 21 48 18 44 17 C36 21 22 19 17 17.5 C13.5 19.5 11.5 23 10.5 27 Z",
  bob: "M10.5 28 C9 11 20 6.5 32 6.5 C44 6.5 55 11 53.5 28 C49 20 42 16.5 32 17 C22 16.5 15 20 10.5 28 Z",
  long: "M10.5 28 C9 11 20 6.5 32 6.5 C44 6.5 55 11 53.5 28 C51 22 47 18 42 16 C34 22 20 22 10.5 28 Z",
  bun: "M10.5 27 C9 11 20 7 32 7 C44 7 55 11 53.5 27 C50 20 42 16 32 14.5 C22 16 14 20 10.5 27 Z",
  ponytail:
    "M10.5 27 C9 11 20 6.5 32 6.5 C44 6.5 55 11 53.5 27 C50 21 45 17 38 16.5 C32 20 20 20.5 10.5 27 Z",
};
const CURLS: Array<[number, number, number]> = [
  [12.5, 24, 5.2],
  [51.5, 24, 5.2],
  [16, 17, 7],
  [48, 17, 7],
  [24, 11, 7.6],
  [41, 11, 7.6],
  [32.5, 9, 8],
];

function BackHair({ look }: { look: AvatarLook }) {
  const fill = shade(look.hairColour, -0.12);
  switch (look.hairStyle) {
    case "bob":
      return <path d="M8 28 C6 8 58 8 56 28 L56 44 Q56 48 51 48 L13 48 Q8 48 8 44 Z" fill={fill} {...STROKE} />;
    case "long":
      return (
        <path
          d="M8 28 C6 7 58 7 56 28 L58 59 Q52 63 46.5 59 L46 40 L18 40 L17.5 59 Q12 63 6 59 Z"
          fill={fill}
          {...STROKE}
        />
      );
    case "ponytail":
      return (
        <path
          d="M48 13 C60 10 64 22 61 33 C60 39 57 43 53 45 C55 37 54 27 48 21 Z"
          fill={fill}
          {...STROKE}
          className="av-sway"
        />
      );
    case "bun":
      return <circle cx="32" cy="5.5" r="6.8" fill={fill} {...STROKE} />;
    default:
      return null;
  }
}

function FrontHair({ look }: { look: AvatarLook }) {
  const fill = look.hairColour;
  if (look.hairStyle === "curly") {
    return (
      <g>
        {CURLS.map(([cx, cy, r]) => (
          <circle key={`o${cx}`} cx={cx} cy={cy} r={r} fill={fill} {...STROKE} />
        ))}
        {CURLS.map(([cx, cy, r]) => (
          <circle key={`f${cx}`} cx={cx} cy={cy} r={r - 0.6} fill={fill} />
        ))}
        <path d="M21 16 q2 -3 5 -2 M36 14 q3 -3 6 -1" fill="none" stroke={shade(fill, 0.25)} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <path d={FRINGE[look.hairStyle] ?? FRINGE.short} fill={fill} {...STROKE} />
      <path d="M20 12.5 q6 -3.5 13 -3" fill="none" stroke={shade(fill, 0.28)} strokeWidth="1.5" strokeLinecap="round" />
      {look.hairStyle === "ponytail" ? <rect x="48" y="14" width="4.5" height="6" rx="2" fill="#ef6f55" {...THIN} /> : null}
    </g>
  );
}

function Outfit({ look }: { look: AvatarLook }) {
  const colour = look.outfitColour;
  const dark = shade(colour, -0.22);
  const light = shade(colour, 0.35);
  const torso = <path d="M21 52 Q32 47 43 52 L45 69 Q32 72.5 19 69 Z" fill={colour} {...STROKE} />;
  let detail: ReactNode = null;
  switch (look.outfitStyle) {
    case "polo":
      detail = (
        <g>
          <path d="M27 49.8 L32 54.5 L28 56.5 Z M37 49.8 L32 54.5 L36 56.5 Z" fill={light} {...THIN} />
          <path d="M32 55 V62" fill="none" {...THIN} />
        </g>
      );
      break;
    case "blazer":
      detail = (
        <g>
          <path d="M27 49.8 L32 61 L37 49.8 Q32 52 27 49.8 Z" fill="#fffaf0" {...THIN} />
          <path d="M27 49.8 L32 61 L25.8 58 Z M37 49.8 L32 61 L38.2 58 Z" fill={dark} {...THIN} />
          <circle cx="32" cy="65" r="1.1" fill={OUTLINE} />
        </g>
      );
      break;
    case "cardigan":
      detail = (
        <g>
          <path d="M28.5 50 L29.5 70.4 L34.5 70.4 L35.5 50 Q32 52 28.5 50 Z" fill="#fffaf0" {...THIN} />
          <circle cx="37.6" cy="58" r="0.9" fill={OUTLINE} />
          <circle cx="37.9" cy="63" r="0.9" fill={OUTLINE} />
        </g>
      );
      break;
    case "blouse":
      detail = (
        <g>
          <path d="M26.5 50 Q28.5 56.5 32 52.8 Q35.5 56.5 37.5 50 Q32 52.6 26.5 50 Z" fill="#fffaf0" {...THIN} />
          <path d="M32 55 L29.6 58.6 L32 57.6 L34.4 58.6 Z" fill={dark} {...THIN} />
        </g>
      );
      break;
    case "barong":
      detail = (
        <g>
          <path d="M27 49.8 L32 54.5 L28 56.5 Z M37 49.8 L32 54.5 L36 56.5 Z" fill={shade(colour, -0.1)} {...THIN} />
          <path d="M32 55 V69" fill="none" {...THIN} />
          <path d="M28.6 57 V68 M35.4 57 V68" fill="none" stroke={shade(colour, -0.32)} strokeWidth="1.3" strokeDasharray="1.2 2" strokeLinecap="round" />
        </g>
      );
      break;
    case "hoodie":
      detail = (
        <g>
          <path d="M25 62 H39 L40.5 69.6 Q32 71.6 23.5 69.6 Z" fill={dark} {...THIN} />
          <path d="M29.4 52 V58 M34.6 52 V58" fill="none" stroke="#fffaf0" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
      break;
  }
  return (
    <g>
      {look.outfitStyle === "hoodie" ? <path d="M17.5 51 Q32 39 46.5 51 Q32 57 17.5 51 Z" fill={dark} {...STROKE} /> : null}
      <rect x="14" y="52" width="7" height="14.5" rx="3.5" fill={colour} {...STROKE} transform="rotate(9 17.5 52)" />
      <rect x="43" y="52" width="7" height="14.5" rx="3.5" fill={colour} {...STROKE} transform="rotate(-9 46.5 52)" />
      <circle cx="15.8" cy="66.8" r="3.1" fill={look.skin} {...THIN} />
      <circle cx="48.2" cy="66.8" r="3.1" fill={look.skin} {...THIN} />
      {torso}
      {detail}
    </g>
  );
}

function Accessory({ look }: { look: AvatarLook }) {
  switch (look.accessory) {
    case "glasses":
      return (
        <g>
          <rect x="18.6" y="26.2" width="11.6" height="9.6" rx="3.8" fill="rgba(255,255,255,0.28)" {...THIN} />
          <rect x="33.8" y="26.2" width="11.6" height="9.6" rx="3.8" fill="rgba(255,255,255,0.28)" {...THIN} />
          <path d="M30.2 30.4 H33.8" fill="none" {...THIN} />
        </g>
      );
    case "headset":
      return (
        <g>
          <path d="M9.5 28 C9.5 3 54.5 3 54.5 28" fill="none" stroke={OUTLINE} strokeWidth="5.6" strokeLinecap="round" />
          <path d="M9.5 28 C9.5 3 54.5 3 54.5 28" fill="none" stroke="#8d96a8" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="5.6" y="24" width="7.6" height="12.5" rx="3.2" fill="#474e5e" {...THIN} />
          <rect x="50.8" y="24" width="7.6" height="12.5" rx="3.2" fill="#474e5e" {...THIN} />
          <path d="M9.5 36.5 Q11 44.5 21 43.6" fill="none" {...THIN} />
          <circle cx="22" cy="43.5" r="2" fill="#474e5e" {...THIN} />
        </g>
      );
    case "lanyard":
      return (
        <g>
          <path d="M27 50.4 L32 62 L37 50.4" fill="none" stroke="var(--accent, #ff5a3c)" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
          <rect x="28.4" y="61" width="7.2" height="8.2" rx="1.3" fill="#fffaf0" {...THIN} />
          <path d="M30.2 64 H33.8 M30.2 66.4 H33" fill="none" stroke={OUTLINE} strokeWidth="1" strokeLinecap="round" />
        </g>
      );
    case "earrings":
      return (
        <g>
          <circle cx="11.2" cy="35.8" r="1.9" fill="#f4c542" {...THIN} />
          <circle cx="52.8" cy="35.8" r="1.9" fill="#f4c542" {...THIN} />
        </g>
      );
    case "clipboard":
      return (
        <g>
          <rect x="41.5" y="56.5" width="13.5" height="17" rx="1.6" fill="#c08a52" {...THIN} />
          <rect x="43.6" y="59.6" width="9.3" height="11.6" rx="0.8" fill="#fffaf0" stroke={OUTLINE} strokeWidth="1" />
          <path d="M45.4 62.6 H51 M45.4 65.2 H51 M45.4 67.8 H49" fill="none" stroke={OUTLINE} strokeWidth="0.9" strokeLinecap="round" />
          <rect x="45.6" y="54.8" width="5.4" height="3.4" rx="1" fill="#8d96a8" {...THIN} />
          <circle cx="42.6" cy="67" r="2.9" fill={look.skin} {...THIN} />
        </g>
      );
    case "notebook":
      return (
        <g>
          <rect x="41.5" y="57" width="13" height="16" rx="1.8" fill="#3d6fb6" {...THIN} />
          <path d="M44.6 57 V73" fill="none" stroke={OUTLINE} strokeWidth="1.2" />
          <rect x="46.6" y="60.4" width="6" height="3.6" rx="0.8" fill="#fffaf0" stroke={OUTLINE} strokeWidth="0.9" />
          <circle cx="42.6" cy="67" r="2.9" fill={look.skin} {...THIN} />
        </g>
      );
    case "mug":
      return (
        <g>
          <path d="M11 55.5 q-2 -2.5 0 -5 M14.6 55.5 q-2 -2.5 0 -5" fill="none" stroke="#fffaf0" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
          <path d="M17.6 60.6 h2.6 a2.6 2.6 0 0 1 0 5.4 h-2.6" fill="none" {...THIN} />
          <rect x="8.4" y="58" width="9.6" height="10" rx="2" fill="#fffaf0" {...THIN} />
          <path d="M8.4 61.4 H18" fill="none" stroke="var(--accent, #ff5a3c)" strokeWidth="1.6" />
          <circle cx="12.6" cy="68.4" r="2.9" fill={look.skin} {...THIN} />
        </g>
      );
    case "bow":
      return (
        <g>
          <path d="M45 10.5 L38 6 L38.6 15 Z M45 10.5 L52 6 L51.4 15 Z" fill="#ef6f55" {...THIN} />
          <circle cx="45" cy="10.5" r="2.3" fill="#ef6f55" {...THIN} />
        </g>
      );
    default:
      return null;
  }
}

type FigureProps = {
  avatar?: Partial<AvatarTokens>;
  seed: string;
  idle?: boolean;
  shadow?: boolean;
};

// The drawing itself, in a 64 x 84 box, as a <g> so it can live inside a larger SVG scene.
export function AvatarFigure({ avatar, seed, idle = true, shadow = true }: FigureProps) {
  const look = resolveLook(avatar, seed);
  const offset = phase(seed);
  const bob: CSSProperties = { animationDelay: `${-(offset * 2.6).toFixed(2)}s` };
  const blink: CSSProperties = { animationDelay: `${-(offset * 4.8).toFixed(2)}s` };
  return (
    <g className={idle ? "av av-idle" : "av"}>
      {shadow ? <ellipse cx="32" cy="79.5" rx="15" ry="3.4" fill="rgba(0,0,0,0.28)" /> : null}
      <g className="av-body" style={bob}>
        {look.hairStyle === "long" ? <BackHair look={look} /> : null}
        <rect x="24.6" y="66" width="6.4" height="10" rx="2" fill="#2b3040" {...STROKE} />
        <rect x="33" y="66" width="6.4" height="10" rx="2" fill="#2b3040" {...STROKE} />
        <rect x="22.8" y="74" width="8.6" height="4.6" rx="2.2" fill={OUTLINE} />
        <rect x="32.6" y="74" width="8.6" height="4.6" rx="2.2" fill={OUTLINE} />
        <Outfit look={look} />
        <g className="av-head" style={bob}>
          {look.hairStyle !== "long" ? <BackHair look={look} /> : null}
          <circle cx="11.4" cy="30" r="4" fill={look.skin} {...STROKE} />
          <circle cx="52.6" cy="30" r="4" fill={look.skin} {...STROKE} />
          <rect x="11" y="8.5" width="42" height="39.5" rx="19.5" ry="18.5" fill={look.skin} {...STROKE} />
          <ellipse cx="19" cy="37.6" rx="3.3" ry="2" fill="#ef7f6d" opacity="0.42" />
          <ellipse cx="45" cy="37.6" rx="3.3" ry="2" fill="#ef7f6d" opacity="0.42" />
          <g className="av-eyes" style={blink}>
            <ellipse cx="24.5" cy="31" rx="2.7" ry="3.8" fill={OUTLINE} />
            <ellipse cx="39.5" cy="31" rx="2.7" ry="3.8" fill={OUTLINE} />
            <circle cx="25.4" cy="29.5" r="1" fill="#ffffff" />
            <circle cx="40.4" cy="29.5" r="1" fill="#ffffff" />
          </g>
          <path d="M28.8 39.6 Q32 42.8 35.2 39.6" fill="none" {...THIN} />
          <FrontHair look={look} />
          <Accessory look={look} />
        </g>
      </g>
    </g>
  );
}

type AvatarProps = {
  avatar?: Partial<AvatarTokens>;
  seed: string;
  size?: number;
  idle?: boolean;
  title?: string;
  className?: string;
};

export function Avatar({ avatar, seed, size = 72, idle = true, title, className }: AvatarProps) {
  return (
    <svg
      className={className}
      viewBox="0 -4 64 88"
      width={size}
      height={(size * 88) / 64}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <AvatarFigure avatar={avatar} seed={seed} idle={idle} />
    </svg>
  );
}

// Head and shoulders only, for badges beside a name.
export function AvatarHead({ avatar, seed, size = 28, title, className }: AvatarProps) {
  return (
    <svg
      className={className}
      viewBox="2 -4 60 60"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <AvatarFigure avatar={avatar} seed={seed} idle={false} shadow={false} />
    </svg>
  );
}
