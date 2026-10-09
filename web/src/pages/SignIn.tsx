import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { TamsMark } from "../components/Tams";
import { useSession } from "../lib/session";

const DEMO_ACCOUNTS = [
  { username: "marisol", name: "Marisol", note: "Office admin - sees it all" },
  { username: "bea", name: "Bea", note: "New hire - sees their own work" },
  { username: "lourdes", name: "Lourdes", note: "Coordinator, FIN201" },
  { username: "celso", name: "Celso", note: "Department chair - admin" },
];

const GOOGLE_NOTICE: Record<string, string> = {
  pending: "Google credentials were found on this machine, but Google sign-in is not switched on in this build yet. Use a username and password for now.",
  "not-configured": "Google sign-in is not configured yet on this machine. Use a username and password for now.",
};

export function SignIn() {
  const { signIn, office } = useSession();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const googleNotice = GOOGLE_NOTICE[params.get("google") ?? ""];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <section className="signin-show stage">
        <div className="row">
          <TamsMark size={52} />
          <strong style={{ fontSize: "var(--text-lg)", fontWeight: 720, letterSpacing: "-0.02em" }}>Deskmate</strong>
        </div>
        <div>
          <h1>
            The colleague at the <em>next desk.</em>
          </h1>
          <p>
            One tidy cabinet for every syllabus, deck, quiz and book. Every office process written down with a real example. And Tams, who answers from
            your own documents on your own machine.
          </p>
        </div>
        <div className="signin-facts">
          <div>
            <strong>Runs locally</strong>
            Tams keeps answering with the wifi off
          </div>
          <div>
            <strong>Stays private</strong>
            Office documents never leave this computer
          </div>
          <div>
            <strong>No meter</strong>
            No cost per question
          </div>
        </div>
      </section>
      <section className="signin-work">
        <form className="signin-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">{office?.name ?? "Deskmate"}</p>
            <h2 className="h2">Sign in</h2>
          </div>
          {googleNotice && <p className="notice">{googleNotice}</p>}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="field">
            <label htmlFor="username">Username or email</label>
            <input id="username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn primary" disabled={busy || !username || !password}>
            {busy ? "Signing in" : "Sign in"}
          </button>
          <div className="or">or</div>
          <a className="btn" href="/auth/google">
            <GoogleGlyph /> Continue with Google
          </a>
          <div className="stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            <p className="small muted">
              Demo accounts for the sample office. The password for all of them is <strong className="mono">deskmate</strong>.
            </p>
            <div className="accounts">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  type="button"
                  key={a.username}
                  onClick={() => {
                    setUsername(a.username);
                    setPassword("deskmate");
                  }}
                >
                  <strong>{a.name}</strong>
                  <small>{a.note}</small>
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
