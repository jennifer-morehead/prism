import { ConceptSummary } from "../types/contracts";

interface ConceptCardListProps {
  concepts: ConceptSummary[];
  lensDisplayOrder?: number;
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
          </article>
        ))}
      </div>
    </section>
  );
}
