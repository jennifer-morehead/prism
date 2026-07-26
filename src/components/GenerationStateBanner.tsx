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
    <aside className={`state-banner state-${status}`}>
      <p className="status-copy">Status: {status}</p>
      {progressHint ? (
        <p className="status-copy">Progress: {progressHint}</p>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
      <button type="button" onClick={onRegenerate}>
        Regenerate
      </button>
    </aside>
  );
}
