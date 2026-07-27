import { ConceptSummary } from "../types/contracts";

interface ConceptCardListProps {
  concepts: ConceptSummary[];
  lensDisplayOrder?: number;
}

function searchQueryFor(concept: ConceptSummary): string {
  if (concept.searchQuery?.trim()) {
    return concept.searchQuery.trim();
  }

  return `${concept.title} ${concept.body}`.split(/\s+/).slice(0, 12).join(" ");
}

export function ConceptCardList({
  concepts,
  lensDisplayOrder = 0,
}: ConceptCardListProps) {
  return (
    <section
      className={`card-panel lens-accent-${((lensDisplayOrder - 1) % 4) + 1}`}
    >
      <h2>Key concepts</h2>
      <div className="concept-grid">
        {concepts.map((concept) => (
          <article className="concept-card" key={concept.id}>
            <h3>{concept.title}</h3>
            <p>{concept.body}</p>
            <a
              className="concept-explore"
              href={`https://www.google.com/search?q=${encodeURIComponent(
                searchQueryFor(concept),
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 3h7v7M13 3 6 10M3 6v7h7" />
              </svg>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
