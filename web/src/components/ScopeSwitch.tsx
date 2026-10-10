import type { Scope } from "../lib/scope";

export function ScopeSwitch({ scope, setScope }: { scope: Scope; setScope: (s: Scope) => void }) {
  return (
    <div className="seg" role="group" aria-label="What to show">
      <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>
        Mine
      </button>
      <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>
        Whole office
      </button>
    </div>
  );
}
