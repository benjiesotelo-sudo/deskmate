import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfficeProcess, ProcessStep } from "./types.ts";

export const STEP_MS = 2500;

export function findStart(process: OfficeProcess): ProcessStep | undefined {
  return process.steps.find((step) => step.kind === "start") ?? process.steps[0];
}

// The order a process is played in: one worked run from the start step to an end step.
// At each step it follows the first link it has not walked yet, so a decision whose first
// link is a "send it back" branch plays that loop once and then carries on to the end.
// Every step is visited at most twice and the run always terminates.
export function buildRun(process: OfficeProcess): string[] {
  const byId = new Map(process.steps.map((step) => [step.id, step]));
  const visits = new Map<string, number>();
  const run: string[] = [];
  let current = findStart(process);
  const limit = process.steps.length * 2 + 1;
  while (current && run.length < limit) {
    run.push(current.id);
    visits.set(current.id, (visits.get(current.id) ?? 0) + 1);
    if (current.kind === "end") break;
    const options = current.next.filter((id) => byId.has(id));
    const fresh = options.find((id) => !visits.has(id));
    const again = options.find((id) => (visits.get(id) ?? 0) < 2);
    const nextId: string | undefined = fresh ?? again;
    current = nextId ? byId.get(nextId) : undefined;
  }
  return run;
}

export type Playback = {
  run: string[];
  index: number; // -1 before the first step
  stepId: string | null;
  previousStepId: string | null;
  playing: boolean;
  finished: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  back: () => void;
  restart: () => void;
  stop: () => void;
  goTo: (index: number) => void;
};

// A small step-by-step player. One timer, no animation loop: it only moves an index,
// and CSS does the drawing, so it stays smooth on a small machine.
export function usePlayback(process: OfficeProcess | undefined, options?: { autoStart?: boolean; stepMs?: number }): Playback {
  const stepMs = options?.stepMs ?? STEP_MS;
  const run = useMemo(() => (process ? buildRun(process) : []), [process]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const autoStarted = useRef<string | null>(null);

  // Reset when a different process is loaded; optionally start straight away.
  const processId = process?.id ?? null;
  useEffect(() => {
    if (!processId) {
      setIndex(-1);
      setPlaying(false);
      autoStarted.current = null;
      return;
    }
    if (options?.autoStart && autoStarted.current !== processId) {
      autoStarted.current = processId;
      setIndex(0);
      setPlaying(true);
    } else if (!options?.autoStart) {
      setIndex(-1);
      setPlaying(false);
    }
  }, [processId, options?.autoStart]);

  const last = run.length - 1;
  const finished = run.length > 0 && index >= last;

  useEffect(() => {
    if (!playing || run.length === 0) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((value) => Math.min(value + 1, last)), index < 0 ? 350 : stepMs);
    return () => window.clearTimeout(timer);
  }, [playing, index, last, run.length, stepMs]);

  const play = useCallback(() => {
    if (run.length === 0) return;
    setIndex((value) => (value >= last ? 0 : value));
    setPlaying(true);
  }, [run.length, last]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);
  const next = useCallback(() => {
    setPlaying(false);
    setIndex((value) => Math.min(value + 1, last));
  }, [last]);
  const back = useCallback(() => {
    setPlaying(false);
    setIndex((value) => Math.max(value - 1, 0));
  }, []);
  const restart = useCallback(() => {
    if (run.length === 0) return;
    setIndex(0);
    setPlaying(true);
  }, [run.length]);
  const stop = useCallback(() => {
    setPlaying(false);
    setIndex(-1);
  }, []);
  const goTo = useCallback(
    (target: number) => {
      setPlaying(false);
      setIndex(Math.max(0, Math.min(target, last)));
    },
    [last],
  );

  return {
    run,
    index,
    stepId: index >= 0 ? (run[index] ?? null) : null,
    previousStepId: index > 0 ? (run[index - 1] ?? null) : null,
    playing,
    finished,
    play,
    pause,
    toggle,
    next,
    back,
    restart,
    stop,
    goTo,
  };
}
