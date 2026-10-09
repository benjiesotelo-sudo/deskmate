import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Me, type Office } from "./api";

type Session = {
  loading: boolean;
  me: Me | null;
  office: Office | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [office, setOffice] = useState<Office | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ person: Me | null; office: Office }>("/api/me");
      setMe(data.person);
      setOffice(data.office);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const signedOut = () => setMe(null);
    window.addEventListener("deskmate:signed-out", signedOut);
    return () => window.removeEventListener("deskmate:signed-out", signedOut);
  }, [refresh]);

  const signIn = useCallback(async (username: string, password: string) => {
    const data = await api<{ person: Me }>("/auth/login", { method: "POST", json: { username, password } });
    setMe(data.person);
  }, []);

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" });
    sessionStorage.clear();
    setMe(null);
  }, []);

  return <SessionContext.Provider value={{ loading, me, office, signIn, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
