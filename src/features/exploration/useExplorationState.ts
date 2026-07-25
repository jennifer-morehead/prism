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
  pollIntervalMs = 700,
}: UseExplorationStateArgs): ExplorationState {
  const [status, setStatus] = useState<ExplorationUiStatus>("idle");
  const [data, setData] = useState<GetLensExplorationViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const pollingRef = useRef(false);
  const autoStartRef = useRef(false);

  const toErrorMessage = useCallback((value: unknown): string => {
    if (value instanceof Error && value.message) {
      return value.message;
    }
    return "Something went wrong while loading exploration data.";
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const hydrated = await getLensExplorationView({ topicSessionId, lensId });
      setData(hydrated);

      if (
        hydrated.generation.latestRunId &&
        hydrated.generation.status !== "succeeded" &&
        hydrated.generation.status !== "failed"
      ) {
        activeRunIdRef.current = hydrated.generation.latestRunId;
      }

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
    } catch (cause) {
      setStatus("failed");
      setError(toErrorMessage(cause));
    }
  }, [topicSessionId, lensId, toErrorMessage]);

  const pollUntilTerminal = useCallback(async () => {
    if (!activeRunIdRef.current || pollingRef.current) {
      return;
    }

    pollingRef.current = true;
    let terminal = false;
    try {
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
    } catch (cause) {
      setStatus("failed");
      setError(toErrorMessage(cause));
    } finally {
      pollingRef.current = false;
    }
  }, [hydrate, pollIntervalMs, toErrorMessage]);

  const startGeneration = useCallback(async () => {
    setError(null);
    setStatus("loading");

    try {
      const run = await generateLensView({
        topicSessionId,
        lensId,
        retrievalEnabled: true,
        forceRegenerate: false,
      });

      activeRunIdRef.current = run.generationRunId;
      void pollUntilTerminal();
    } catch (cause) {
      setStatus("failed");
      setError(toErrorMessage(cause));
    }
  }, [topicSessionId, lensId, pollUntilTerminal, toErrorMessage]);

  const triggerRegeneration = useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      const run = await regenerateLensView({ topicSessionId, lensId });
      activeRunIdRef.current = run.generationRunId;
      void pollUntilTerminal();
    } catch (cause) {
      setStatus("failed");
      setError(toErrorMessage(cause));
    }
  }, [topicSessionId, lensId, pollUntilTerminal, toErrorMessage]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (
      autoStartRef.current ||
      data?.refractedView.status !== "draft" ||
      data?.generation.latestRunId ||
      status === "ready" ||
      status === "failed"
    ) {
      return;
    }

    autoStartRef.current = true;
    void startGeneration();
  }, [data, status, startGeneration]);

  useEffect(() => {
    if (activeRunIdRef.current && status !== "ready" && status !== "failed") {
      void pollUntilTerminal();
    }
  }, [pollUntilTerminal, status]);

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
