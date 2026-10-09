import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { useSession } from "./lib/session";
import { Cabinet } from "./pages/Cabinet";
import { ComingSoon } from "./pages/ComingSoon";
import { CoursePage } from "./pages/CoursePage";
import { DocumentPage } from "./pages/DocumentPage";
import { FilePage } from "./pages/FilePage";
import { ReadinessPage } from "./pages/ReadinessPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignIn } from "./pages/SignIn";
import { TamsPage } from "./pages/TamsPage";

export function App() {
  const { loading, me } = useSession();
  if (loading) return null;
  if (!me) {
    return (
      <Routes>
        <Route path="*" element={<SignIn />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to="/cabinet" replace />} />
        <Route path="/signin" element={<Navigate to="/cabinet" replace />} />
        <Route path="/cabinet" element={<Cabinet />} />
        <Route path="/cabinet/file" element={<FilePage />} />
        <Route path="/cabinet/:course" element={<CoursePage />} />
        <Route path="/documents/:id" element={<DocumentPage />} />
        <Route path="/readiness" element={<ReadinessPage />} />
        <Route path="/tams" element={<TamsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Reserved for the office module (web/src/office and web/src/processes). */}
        <Route path="/office" element={<ComingSoon what="office" />} />
        <Route path="/processes/:id" element={<ComingSoon what="process" />} />
        <Route path="*" element={<Navigate to="/cabinet" replace />} />
      </Route>
    </Routes>
  );
}
