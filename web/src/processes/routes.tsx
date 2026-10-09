import type { RouteObject } from "react-router-dom";
import { OfficePage } from "../office/OfficePage.tsx";
import { ProcessListPage } from "./ProcessListPage.tsx";
import { ProcessPage } from "./ProcessPage.tsx";

// The routes this module owns. The app shell registers them in its router:
//   /office (and /office?play=<processId>), /processes, /processes/:id
export const officeRoutes: RouteObject[] = [
  { path: "/office", element: <OfficePage /> },
  { path: "/processes", element: <ProcessListPage /> },
  { path: "/processes/:id", element: <ProcessPage /> },
];

export { OfficePage, ProcessListPage, ProcessPage };
