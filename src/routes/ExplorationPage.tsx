import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConceptCardList } from "../components/ConceptCardList";
import { ConnectionList } from "../components/ConnectionList";
import { GenerationStateBanner } from "../components/GenerationStateBanner";
import { RefractedHero } from "../components/RefractedHero";
import { HomeLink } from "../components/HomeLink";
import { NewTopicPrompt } from "../components/NewTopicPrompt";
import { useExplorationState } from "../features/exploration/useExplorationState";
import { generateFollowOnLenses } from "../features/exploration/exploration.api";
import { getTopicSession } from "../features/topic/topic.api";

export function ExplorationPage() {
  const navigate = useNavigate();
  const { topicSessionId, lensId } = useParams();
  const [isGeneratingFollowOns, setIsGeneratingFollowOns] = useState(false);
  const [followOnError, setFollowOnError] = useState<string | null>(null);
  const [lensDisplayOrder, setLensDisplayOrder] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    void getTopicSession({ topicSessionId })
      .then((session) => {
        if (!cancelled) {
          setLensDisplayOrder(session.selectedLens?.displayOrder ?? 0);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [topicSessionId]);

  const handleGenerateFollowOns = async () => {
    if (!data) return;
    setIsGeneratingFollowOns(true);
    setFollowOnError(null);
    try {
      await generateFollowOnLenses({
        topicSessionId,
        lensId,
        refractedViewId: data.refractedView.id,
      });
      navigate(`/session/${topicSessionId}/lenses`);
    } catch (cause) {
      setFollowOnError(
        cause instanceof Error
          ? cause.message
          : "Unable to generate new perspectives",
      );
    } finally {
      setIsGeneratingFollowOns(false);
    }
  };

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
        onRegenerate={() => void triggerRegeneration()}
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
              <button
                type="button"
                disabled={isGeneratingFollowOns}
                onClick={() => void handleGenerateFollowOns()}
              >
                {isGeneratingFollowOns
                  ? "Finding new angles..."
                  : "Generate new perspectives"}
              </button>
              {followOnError ? (
                <p className="inline-error">{followOnError}</p>
              ) : null}
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

      <NewTopicPrompt showSuggestions={false} />
    </main>
  );
}
