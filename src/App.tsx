import { Navigate, Route, Routes } from "react-router-dom";
import { TopicEntryPage } from "./routes/TopicEntryPage";
import { LensSelectionPage } from "./routes/LensSelectionPage";
import { ExplorationPage } from "./routes/ExplorationPage";
import { runtimeProvider } from "./lib/runtimeProvider";

export function App() {
  const runtimeLabel = runtimeProvider === "local" ? "LOCAL" : "BASE44";

  return (
    <>
      <aside className={`runtime-badge runtime-${runtimeProvider}`}>
        Runtime: {runtimeLabel}
      </aside>
      <Routes>
        <Route path="/" element={<TopicEntryPage />} />
        <Route
          path="/session/:topicSessionId/lenses"
          element={<LensSelectionPage />}
        />
        <Route
          path="/session/:topicSessionId/lens/:lensId"
          element={<ExplorationPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
