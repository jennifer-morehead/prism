interface GenerationStateBannerProps {
  status: "idle" | "loading" | "partial" | "ready" | "failed";
  progressHint: string | null;
  error: string | null;
}

export function GenerationStateBanner({
  status,
  progressHint,
  error,
}: GenerationStateBannerProps) {
  if (status === "ready") {
    return null;
  }

  if (status === "idle" || status === "loading" || status === "partial") {
    return <p className="status-copy">Loading refraction...</p>;
  }

  return (
    <aside className={`state-banner state-${status}`}>
      <p className="status-copy">Status: {status}</p>
      {progressHint ? (
        <p className="status-copy">Progress: {progressHint}</p>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
      <p className="feature-availability">Choose another topic to try again.</p>
    </aside>
  );
}
