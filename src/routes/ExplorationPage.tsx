import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConceptCardList } from "../components/ConceptCardList";
import { ConnectionList } from "../components/ConnectionList";
import { GenerationStateBanner } from "../components/GenerationStateBanner";
import { RefractedHero } from "../components/RefractedHero";
import { HomeLink } from "../components/HomeLink";
import { NewTopicPrompt } from "../components/NewTopicPrompt";
import { useExplorationState } from "../features/exploration/useExplorationState";
import { getTopicSession } from "../features/topic/topic.api";

export function ExplorationPage() {
  const { topicSessionId, lensId } = useParams();
  const [lensDisplayOrder, setLensDisplayOrder] = useState(0);
  const [topicText, setTopicText] = useState<string | null>(null);

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
  } = useExplorationState({
    topicSessionId,
    lensId,
  });

  useEffect(() => {
    let cancelled = false;
    void getTopicSession({ topicSessionId })
      .then((session) => {
        if (!cancelled) {
          setLensDisplayOrder(session.selectedLens?.displayOrder ?? 0);
          setTopicText(session.topicSession.topicText);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [topicSessionId]);

  return (
    <main className="page page-exploration">
      <header className="page-header">
        <Link className="back-link" to={`/session/${topicSessionId}/lenses`}>
          <span aria-hidden="true">←</span>
          All lenses
        </Link>
        <HomeLink />
      </header>
      <GenerationStateBanner
        status={status}
        progressHint={progressHint}
        error={error}
      />

      {data ? (
        <>
          <RefractedHero
            view={data.refractedView}
            lensDisplayOrder={lensDisplayOrder}
          />
          <ConceptCardList
            concepts={data.concepts}
            lensDisplayOrder={lensDisplayOrder}
          />
          <ConnectionList
            concepts={data.concepts}
            connections={data.connections}
          />
          {data.refractedView.status === "ready" ? (
            <section className="follow-on-panel">
              <p className="eyebrow">Continue exploring</p>
              <h2>Find new angles from this refraction</h2>
              <p>
                Generate four fresh perspectives shaped by the ideas above.
              </p>
              <button type="button" disabled>
                Generate new perspectives
              </button>
              <p className="feature-availability availability-copy">
                Available in full Prism
              </p>
            </section>
          ) : null}
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

      {data?.refractedView.status === "ready" && topicText ? (
        <NewTopicPrompt excludeTopic={topicText} />
      ) : null}
    </main>
  );
}
