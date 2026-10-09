import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AvatarHead } from "../avatars/Avatar.tsx";
import { personById } from "./api.ts";
import { DocIcon } from "./icons.tsx";
import { CIRCLE_R, DIAMOND_R, layoutProcess, TASK_H, TASK_W, type FlowEdge } from "./layout.ts";
import type { OfficeProcess, Person } from "./types.ts";

type Props = {
  process: OfficeProcess;
  people: Person[];
  selectedId: string | null;
  onSelect: (stepId: string) => void;
  activeId?: string | null;
  visited?: ReadonlySet<string>;
  walked?: ReadonlySet<string>; // edge ids "from>to" already travelled in this run
};

const MIN_SCALE = 0.8;

function arrowHead(edge: FlowEdge): string {
  const { x, y, direction } = edge.tip;
  if (direction === "right") return `${x},${y} ${x - 10},${y - 5.5} ${x - 10},${y + 5.5}`;
  if (direction === "up") return `${x},${y} ${x - 5.5},${y + 10} ${x + 5.5},${y + 10}`;
  return `${x},${y} ${x - 5.5},${y - 10} ${x + 5.5},${y - 10}`;
}

// The BPMN-style picture of a process: start and end circles, task boxes, decision diamonds
// and arrows along `next`. Shapes are plain HTML over one SVG of arrows, scaled to fit.
export function ProcessFlow({ process, people, selectedId, onSelect, activeId = null, visited, walked }: Props) {
  const layout = useMemo(() => layoutProcess(process), [process]);
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const fit = () => {
      const available = element.clientWidth;
      if (available > 0) setScale(Math.max(MIN_SCALE, Math.min(1, available / layout.width)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout.width]);

  // Keep the step being played (or picked) in view when the flow is wider than the stage.
  const focusId = activeId ?? selectedId;
  useEffect(() => {
    const element = scroller.current;
    const node = layout.nodes.find((item) => item.step.id === focusId);
    if (!element || !node) return;
    if (element.scrollWidth <= element.clientWidth + 1) return;
    element.scrollTo({ left: node.x * scale - element.clientWidth / 2, behavior: "smooth" });
  }, [focusId, layout, scale]);

  return (
    <div className="flow-scroll" ref={scroller}>
      <div className="flow-fit" style={{ width: layout.width * scale, height: layout.height * scale }}>
        <div className="flow-canvas" style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}>
          <svg className="flow-edges" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
            {layout.edges.map((edge) => {
              const isWalked = walked?.has(edge.id) ?? false;
              return (
                <g key={edge.id} className={`flow-edge${edge.back ? " is-back" : ""}${isWalked ? " is-walked" : ""}`}>
                  <path className="flow-edge-base" d={edge.path} />
                  <polygon className="flow-edge-head" points={arrowHead(edge)} />
                  <path className="flow-edge-ink" d={edge.path} pathLength={1} />
                  <polygon className="flow-edge-head-ink" points={arrowHead(edge)} />
                </g>
              );
            })}
          </svg>
          {layout.nodes.map((node) => {
            const { step } = node;
            const actor = personById(people, step.actor);
            const classes = [
              "flow-node",
              `flow-${step.kind}`,
              step.id === activeId ? "is-active" : "",
              step.id === selectedId ? "is-selected" : "",
              visited?.has(step.id) ? "is-visited" : "",
              layout.unreachable.includes(step.id) ? "is-loose" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const label = `${step.title}. ${actor?.name ?? step.actor}`;
            return (
              <button
                key={step.id}
                type="button"
                className={classes}
                style={{ left: node.x, top: node.y }}
                onClick={() => onSelect(step.id)}
                aria-pressed={step.id === selectedId}
                aria-label={label}
                title={actor ? `${actor.name} - ${actor.role}` : step.actor}
              >
                {step.kind === "task" ? (
                  <span className="flow-shape flow-task-shape" style={{ width: TASK_W, height: TASK_H }}>
                    <span className="flow-title">{step.title}</span>
                    {step.artifact ? (
                      <span className="flow-artifact" aria-hidden="true">
                        <DocIcon size={13} />
                      </span>
                    ) : null}
                  </span>
                ) : step.kind === "decision" ? (
                  <>
                    <span className="flow-caption flow-caption-above">{step.title}</span>
                    <svg className="flow-shape flow-diamond" width={DIAMOND_R * 2} height={DIAMOND_R * 2} viewBox="-40 -40 80 80" aria-hidden="true">
                      <path d="M0 -36 L36 0 L0 36 L-36 0 Z" />
                      <text x="0" y="8" textAnchor="middle">
                        ?
                      </text>
                    </svg>
                  </>
                ) : (
                  <>
                    <span className="flow-shape flow-circle" style={{ width: CIRCLE_R * 2, height: CIRCLE_R * 2 }}>
                      <span className="flow-circle-dot" />
                    </span>
                    <span className="flow-caption flow-caption-below">{step.title}</span>
                  </>
                )}
                <span className="flow-actor">
                  <AvatarHead avatar={actor?.avatar} seed={actor?.id ?? step.actor} size={30} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
