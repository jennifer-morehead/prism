import { RefractedViewSummary } from "../types/contracts";

interface RefractedHeroProps {
  view: RefractedViewSummary;
  lensDisplayOrder?: number;
}

export function RefractedHero({
  view,
  lensDisplayOrder = 0,
}: RefractedHeroProps) {
  const title = (view.title ?? "Generating refracted view")
    .replace(/\s*refracted view\s*/gi, " ")
    .trim();

  return (
    <section className={`hero-card lens-accent-${((lensDisplayOrder - 1) % 4) + 1}`}>
      <p className="breadcrumb">Topic / Lens / Refraction</p>
      <h1>{title || "Generating refraction"}</h1>
      <p className="lede">{view.summary ?? "Summary is not available yet."}</p>
    </section>
  );
}
