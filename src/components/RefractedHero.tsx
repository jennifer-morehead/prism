import { RefractedViewSummary } from "../types/contracts";

interface RefractedHeroProps {
  view: RefractedViewSummary;
}

export function RefractedHero({ view }: RefractedHeroProps) {
  return (
    <section className="hero-card">
      <h1>{view.title ?? "Generating refracted view"}</h1>
      <p className="lede">{view.summary ?? "Summary is not available yet."}</p>
    </section>
  );
}
