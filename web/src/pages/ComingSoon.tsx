import { Link, useParams, useSearchParams } from "react-router-dom";
import { TamsMark } from "../components/Tams";
import { api, type OfficeProcess } from "../lib/api";
import { useLoad } from "../lib/useLoad";

// Placeholder for the routes the office module owns: /office and /processes/:id.
// The office module replaces these two routes in App.tsx with its own screens.
export function ComingSoon({ what }: { what: "office" | "process" }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const processId = what === "process" ? id : (params.get("play") ?? undefined);
  const { data: process } = useLoad(async () => (processId ? api<OfficeProcess>(`/api/processes/${encodeURIComponent(processId)}`).catch(() => null) : null), [processId]);

  return (
    <div className="stage-empty">
      <TamsMark size={72} />
      <p className="eyebrow">{what === "office" ? "The office" : "Process library"}</p>
      <h1>{what === "office" ? "The office view is coming." : "The process page is coming."}</h1>
      <p>
        {what === "office"
          ? "This is where the animated office will play a process step by step, showing who does what and with which document."
          : "This is where a documented process will be shown step by step with its real example."}{" "}
        The module is being built now. Navigation is already wired, so links from Tams land here.
      </p>
      {process && (
        <p>
          You asked for <strong style={{ color: "var(--on-stage)" }}>{process.name}</strong>: {process.steps.length} steps, starting when{" "}
          {process.trigger.charAt(0).toLowerCase() + process.trigger.slice(1)} Until the view arrives, Tams can walk you through it.
        </p>
      )}
      <Link className="btn accent" to="/tams">
        Ask Tams instead
      </Link>
    </div>
  );
}
