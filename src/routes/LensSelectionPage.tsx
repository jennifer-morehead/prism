import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LensCardGrid } from "../components/LensCardGrid";
import { listLenses, selectLens } from "../features/lens/lens.api";
import { LensSummary } from "../types/contracts";

export function LensSelectionPage() {
  const navigate = useNavigate();
  const { topicSessionId } = useParams();
  const [lenses, setLenses] = useState<LensSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await listLenses();
        if (!cancelled) {
          setLenses(data.lenses);
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
  }, []);

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

  const selectableLenses = lenses.map((lens) => ({
    ...lens,
    description: `${lens.description} Select this lens to generate a refracted view.`,
  }));

  return (
    <main className="page page-lenses">
      <h1>Select a perspective lens</h1>
      {isLoading ? <p>Loading lenses...</p> : null}
      {!isLoading && topicSessionId ? (
        <LensCardGrid
          lenses={selectableLenses}
          onSelect={(lensId) => void handleSelect(lensId)}
        />
      ) : null}
      {error ? <p>{error}</p> : null}
    </main>
  );
}
