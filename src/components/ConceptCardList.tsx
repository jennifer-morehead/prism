import { ConceptSummary } from "../types/contracts";

interface ConceptCardListProps {
  concepts: ConceptSummary[];
}

export function ConceptCardList({ concepts }: ConceptCardListProps) {
  return (
    <section>
      <h2>Key concepts</h2>
      <div>
        {concepts.map((concept) => (
          <article key={concept.id}>
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
