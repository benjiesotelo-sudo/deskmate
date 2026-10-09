import { useState } from "react";
import { useSession } from "./session";

export type Scope = "mine" | "all";

// One link for everyone: an admin sees the whole office, a staff account opens
// on what it owns and can look at the rest of the office read-only.
export function useScope(): { scope: Scope; setScope: (s: Scope) => void; isAdmin: boolean } {
  const { me } = useSession();
  const isAdmin = me?.access === "admin";
  const [stored, setStored] = useState<Scope>(() => (sessionStorage.getItem("deskmate.scope") as Scope | null) ?? "mine");
  const scope: Scope = isAdmin ? "all" : stored;
  const setScope = (s: Scope) => {
    sessionStorage.setItem("deskmate.scope", s);
    setStored(s);
  };
  return { scope, setScope, isAdmin };
}
