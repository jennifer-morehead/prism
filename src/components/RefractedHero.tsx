import { RefractedViewSummary } from "../types/contracts";

interface RefractedHeroProps {
  lensName: string;
  view: RefractedViewSummary;
}

export function RefractedHero({ lensName, view }: RefractedHeroProps) {
  return (
    <section>
      <p>{lensName}</p>
      <h1>{view.title ?? "Generating refracted view"}</h1>
      <p>{view.summary ?? "Summary is not available yet."}</p>
    </section>
  );
}
