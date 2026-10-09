// STANDALONE SCAFFOLD - a bare shell so the office and process module can run on its own.
// deskmate-core owns the real app shell; delete web/standalone at merge and register
// `officeRoutes` (web/src/processes/routes.tsx) in core's router instead.
import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { officeRoutes } from "../src/processes/routes";
import "../src/styles/tokens.css";
import "./standalone.css";

function Shell() {
  return (
    <div className="standalone-shell">
      <aside className="standalone-side">
        <strong>Deskmate</strong>
        <small>office module, standalone</small>
        <Link to="/office">The office</Link>
        <Link to="/processes">Processes</Link>
      </aside>
      <main className="standalone-main">
        <Outlet />
      </main>
    </div>
  );
}

function ElsewhereInTheApp() {
  const { pathname, search } = useLocation();
  return (
    <div className="standalone-elsewhere">
      <p>
        <code>{pathname + search}</code> belongs to another part of Deskmate (Tams' chat or the filing cabinet), which is not part of the standalone office
        module.
      </p>
      <p>
        <Link to="/office">Back to the office</Link>
      </p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [{ path: "/", element: <Navigate to="/office" replace /> }, ...officeRoutes, { path: "*", element: <ElsewhereInTheApp /> }],
  },
]);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
