import { ConceptSummary } from "../types/contracts";

interface ConceptCardListProps {
  concepts: ConceptSummary[];
}

export function ConceptCardList({ concepts }: ConceptCardListProps) {
  return (
    <section className="card-panel">
      <h2>Key concepts</h2>
      <div className="concept-grid">
        {concepts.map((concept) => (
          <article className="concept-card" key={concept.id}>
            <h3>
              {concept.ordinal}. {concept.title}
            </h3>
            <p>{concept.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
