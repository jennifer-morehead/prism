import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  generateLensView,
  getGenerationStatus,
  getLensExplorationView,
  regenerateLensView,
} from "./exploration.api";
import { GetLensExplorationViewData } from "../../types/contracts";

export type ExplorationUiStatus =
  | "idle"
  | "loading"
  | "partial"
  | "ready"
  | "failed";

interface UseExplorationStateArgs {
  topicSessionId: string;
  lensId: string;
  pollIntervalMs?: number;
}

interface ExplorationState {
  status: ExplorationUiStatus;
  data: GetLensExplorationViewData | null;
  error: string | null;
  progressHint: string | null;
  startGeneration: () => Promise<void>;
  triggerRegeneration: () => Promise<void>;
}

export function useExplorationState({
  topicSessionId,
  lensId,
  pollIntervalMs = 2500,
}: UseExplorationStateArgs): ExplorationState {
  const [status, setStatus] = useState<ExplorationUiStatus>("idle");
  const [data, setData] = useState<GetLensExplorationViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  const hydrate = useCallback(async () => {
    const hydrated = await getLensExplorationView({ topicSessionId, lensId });
    setData(hydrated);

    if (hydrated.refractedView.status === "ready") {
      setStatus("ready");
      return;
    }

    if (hydrated.refractedView.status === "failed") {
      setStatus("failed");
      return;
    }

    if (hydrated.refractedView.summary || hydrated.concepts.length > 0) {
      setStatus("partial");
      return;
    }

    setStatus("loading");
  }, [topicSessionId, lensId]);

  const pollUntilTerminal = useCallback(async () => {
    if (!activeRunIdRef.current) {
      return;
    }

    let terminal = false;
    while (!terminal) {
      const run = await getGenerationStatus({
        generationRunId: activeRunIdRef.current,
      });
      setProgressHint(run.progressHint);

      if (run.generationRun.status === "succeeded") {
        await hydrate();
        setStatus("ready");
        terminal = true;
      } else if (run.generationRun.status === "failed") {
        setStatus("failed");
        setError(run.generationRun.errorSummary ?? "Generation failed");
        terminal = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }, [hydrate, pollIntervalMs]);

  const startGeneration = useCallback(async () => {
    setError(null);
    setStatus("loading");

    const run = await generateLensView({
      topicSessionId,
      lensId,
      retrievalEnabled: true,
      forceRegenerate: false,
    });

    activeRunIdRef.current = run.generationRunId;
    void pollUntilTerminal();
  }, [topicSessionId, lensId, pollUntilTerminal]);

  const triggerRegeneration = useCallback(async () => {
    setError(null);
    const run = await regenerateLensView({ topicSessionId, lensId });
    activeRunIdRef.current = run.generationRunId;
    void pollUntilTerminal();
  }, [topicSessionId, lensId, pollUntilTerminal]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return useMemo(
    () => ({
      status,
      data,
      error,
      progressHint,
      startGeneration,
      triggerRegeneration,
    }),
    [status, data, error, progressHint, startGeneration, triggerRegeneration],
  );
}
