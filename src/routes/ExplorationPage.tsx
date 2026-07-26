import { Link, useParams } from "react-router-dom";
import { ConceptCardList } from "../components/ConceptCardList";
import { ConnectionList } from "../components/ConnectionList";
import { GenerationStateBanner } from "../components/GenerationStateBanner";
import { RefractedHero } from "../components/RefractedHero";
import { useExplorationState } from "../features/exploration/useExplorationState";

export function ExplorationPage() {
  const { topicSessionId, lensId } = useParams();

  if (!topicSessionId || !lensId) {
    return (
      <main className="page page-exploration">
        <p>Missing route parameters.</p>
      </main>
    );
  }

  const {
    status,
    data,
    error,
    progressHint,
    startGeneration,
    triggerRegeneration,
  } = useExplorationState({
    topicSessionId,
    lensId,
  });

  return (
    <main className="page page-exploration">
      <header className="exploration-head">
        <p className="meta-pill">Session: {topicSessionId}</p>
        <p className="meta-pill">Lens: {lensId}</p>
      </header>

      <GenerationStateBanner
        status={status}
        progressHint={progressHint}
        error={error}
        onRegenerate={() => void triggerRegeneration()}
      />

      {data ? (
        <>
          <RefractedHero lensName={lensId} view={data.refractedView} />
          <ConceptCardList concepts={data.concepts} />
          <ConnectionList
            concepts={data.concepts}
            connections={data.connections}
          />
        </>
      ) : (
        <section className="card-panel">
          <h1>Refracted summary</h1>
          <p>No generated output yet.</p>
          <button type="button" onClick={() => void startGeneration()}>
            Start generation
          </button>
        </section>
      )}

      <Link className="text-link" to={`/session/${topicSessionId}/lenses`}>
        Choose a different lens
      </Link>
    </main>
  );
}
