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

  if (status === "idle" || status === "loading" || status === "partial") {
    return (
      <aside className="loading-indicator" role="status" aria-live="polite">
        <span>Loading</span>
        <span className="loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </aside>
    );
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
