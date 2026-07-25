interface GenerationStateBannerProps {
  status: "idle" | "loading" | "partial" | "ready" | "failed";
  progressHint: string | null;
  error: string | null;
  onRegenerate: () => void;
}

export function GenerationStateBanner({
  status,
  progressHint,
  error,
  onRegenerate,
}: GenerationStateBannerProps) {
  if (status === "ready") {
    return null;
  }

  return (
    <aside>
      <p>Status: {status}</p>
      {progressHint ? <p>Progress: {progressHint}</p> : null}
      {error ? <p>{error}</p> : null}
      <button type="button" onClick={onRegenerate}>
        Regenerate
      </button>
    </aside>
  );
}
