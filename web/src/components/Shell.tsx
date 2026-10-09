import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../lib/session";
import { TamsMark } from "./Tams";

// Stage screens show something. Everything else is a paper work screen.
const STAGE_PATHS = ["/tams", "/office", "/processes"];

export function Shell() {
  const { me, office, signOut } = useSession();
  const { pathname } = useLocation();
  const surface = STAGE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ? "stage" : "paper";

  return (
    <div className="shell" data-surface={surface}>
      <aside className="side">
        <NavLink to="/" className="brand">
          <TamsMark size={38} />
          <span>
            <strong>Deskmate</strong>
            <small>{office?.name}</small>
          </span>
        </NavLink>
        <nav className="nav" aria-label="Main">
          <span className="nav-label">Work</span>
          <NavLink to="/cabinet" className={({ isActive }) => (isActive || pathname.startsWith("/documents/") ? "active" : "")}>
            <span className="dot" />
            Filing cabinet
          </NavLink>
          <NavLink to="/readiness">
            <span className="dot" />
            Readiness
          </NavLink>
          <span className="nav-label">Show</span>
          <NavLink to="/tams">
            <span className="dot" />
            Ask Tams
          </NavLink>
          <NavLink to="/office">
            <span className="dot" />
            The office
          </NavLink>
        </nav>
        <div className="side-foot">
          <div>
            <strong>{me?.name}</strong>
            <small>
              {me?.role} - {me?.access === "admin" ? "sees the whole office" : "sees what they own"}
            </small>
          </div>
          <div className="row">
            <NavLink to="/settings" className="btn quiet small">
              Settings
            </NavLink>
            <button className="btn quiet small" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
