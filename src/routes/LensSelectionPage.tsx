import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LensCardGrid } from "../components/LensCardGrid";
import { HomeLink } from "../components/HomeLink";
import { listLenses, selectLens } from "../features/lens/lens.api";
import { getTopicSession } from "../features/topic/topic.api";
import { LensSummary } from "../types/contracts";

function formatTopicHeader(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toUpperCase()}`,
    );
}

export function LensSelectionPage() {
  const navigate = useNavigate();
  const { topicSessionId } = useParams();
  const [lenses, setLenses] = useState<LensSummary[]>([]);
  const [topicText, setTopicText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [data, session] = await Promise.all([
          listLenses({ topicSessionId }),
          topicSessionId ? getTopicSession({ topicSessionId }) : null,
        ]);
        if (!cancelled) {
          setLenses(data.lenses);
          setTopicText(session?.topicSession.topicText ?? null);
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load lenses";
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [topicSessionId]);

  const handleSelect = async (lensId: string) => {
    if (!topicSessionId) {
      return;
    }

    setError(null);
    try {
      await selectLens({ topicSessionId, lensId });
      navigate(`/session/${topicSessionId}/lens/${lensId}`);
    } catch (selectionError) {
      const message =
        selectionError instanceof Error
          ? selectionError.message
          : "Failed to select lens";
      setError(message);
    }
  };

  return (
    <main className="page page-lenses">
      <header className="page-header">
        <Link className="back-link new-topic-link" to="/">
          <span aria-hidden="true">←</span>
          New Topic
        </Link>
        <HomeLink />
      </header>
      <section className="hero-shell">
        <p className="breadcrumb">Topics / Lens</p>
        <h1>{topicText ? formatTopicHeader(topicText) : "Your topic"}</h1>
        <p className="lede">
          Choose a perspective lens to refract this topic through. Each lens
          surfaces different ideas.
        </p>
      </section>
      {isLoading ? <p className="status-copy">Loading lenses...</p> : null}
      {!isLoading && topicSessionId ? (
        <LensCardGrid
          lenses={lenses}
          onSelect={(lensId) => void handleSelect(lensId)}
        />
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
    </main>
  );
}
