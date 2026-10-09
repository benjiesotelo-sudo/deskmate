import type { Person } from "../processes/types.ts";

// Where things sit in the office scene. One SVG, 1280 x 720 user units: the room on the left,
// the "working from home" strip on the right, so the playback dot can travel between them.

export const SCENE = { width: 1280, height: 720 };
export const ROOM = { x: 20, y: 20, width: 944, height: 680 };
export const HOME = { x: 988, y: 20, width: 272, height: 680 };
export const FRONT_DESK = { x: 176, y: 626 };
// Desk centres are fitted into this band of the room, whatever units `desk.x/y` use.
const DESK_AREA = { left: 150, right: 836, top: 164, bottom: 384 };
const DESK_PITCH = { x: 228, y: 110 }; // widest sensible gap between neighbouring grid cells

export type Point = { x: number; y: number };

function fit(values: number[], low: number, high: number, pitch: number): (value: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const middle = (low + high) / 2;
  if (!Number.isFinite(min) || max === min) return () => middle;
  // Do not stretch a small office across the whole floor: cap the distance per grid unit.
  const scale = Math.min((high - low) / (max - min), pitch);
  const offset = middle - ((min + max) / 2) * scale;
  return (value) => offset + value * scale;
}

// Desk centre for every person, including those at home (their desk stays in the room, empty).
export function placeDesks(people: Person[]): Map<string, Point> {
  const usable = people.filter((person) => Number.isFinite(person.desk?.x) && Number.isFinite(person.desk?.y));
  const toX = fit(usable.map((person) => person.desk.x), DESK_AREA.left, DESK_AREA.right, DESK_PITCH.x);
  const toY = fit(usable.map((person) => person.desk.y), DESK_AREA.top, DESK_AREA.bottom, DESK_PITCH.y);
  const desks = new Map<string, Point>();
  people.forEach((person, index) => {
    if (usable.includes(person)) desks.set(person.id, { x: toX(person.desk.x), y: toY(person.desk.y) });
    // No desk on record: line them up along the back wall rather than dropping them.
    else desks.set(person.id, { x: DESK_AREA.left + ((index * 137) % (DESK_AREA.right - DESK_AREA.left)), y: DESK_AREA.top });
  });
  return desks;
}

// A slot in the home strip for everyone working from home, in the order they appear.
export function placeHome(people: Person[]): Map<string, Point> {
  const atHome = people.filter((person) => person.location === "home");
  const columns = atHome.length > 4 ? 2 : 1;
  const rows = Math.ceil(atHome.length / columns);
  const top = HOME.y + 212;
  const bottom = HOME.y + HOME.height - 70;
  const step = rows > 1 ? Math.min(196, (bottom - top) / (rows - 1)) : 0;
  const slots = new Map<string, Point>();
  atHome.forEach((person, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = HOME.x + (HOME.width / (columns + 1)) * (column + 1);
    slots.set(person.id, { x, y: top + row * step });
  });
  return slots;
}

// Where a person actually is right now: at their desk, or in the home strip.
export function whereabouts(people: Person[]): Map<string, Point> {
  const desks = placeDesks(people);
  const home = placeHome(people);
  const spots = new Map<string, Point>();
  for (const person of people) {
    const spot = person.location === "home" ? home.get(person.id) : desks.get(person.id);
    if (spot) spots.set(person.id, spot);
  }
  return spots;
}
