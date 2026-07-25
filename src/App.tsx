import { Navigate, Route, Routes } from "react-router-dom";
import { TopicEntryPage } from "./routes/TopicEntryPage";
import { LensSelectionPage } from "./routes/LensSelectionPage";
import { ExplorationPage } from "./routes/ExplorationPage";

export function App() {
  return (
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
  );
}
