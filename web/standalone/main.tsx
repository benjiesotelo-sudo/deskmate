// STANDALONE SCAFFOLD - a bare shell so the office and process module can run on its own.
// deskmate-core owns the real app shell; delete web/standalone at merge and register
// `officeRoutes` (web/src/processes/routes.tsx) in core's router instead.
import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider } from "react-router-dom";
import { officeRoutes } from "../src/processes/routes.tsx";
import "../src/styles/tokens.css";
import "./standalone.css";

function Shell() {
  return (
    <>
      <header className="standalone-bar">
        <strong>Deskmate</strong>
        <nav>
          <Link to="/office">Office</Link>
          <Link to="/processes">Processes</Link>
        </nav>
        <span>office module, standalone</span>
      </header>
      <Outlet />
    </>
  );
}

function ElsewhereInTheApp() {
  return (
    <main style={{ padding: 32 }}>
      <p>This page belongs to another part of Deskmate (Tams' chat or the filing cabinet) and is not part of the standalone office module.</p>
      <p>
        <Link to="/office">Back to the office</Link>
      </p>
    </main>
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
