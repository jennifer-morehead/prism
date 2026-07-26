import { ConceptConnectionSummary, ConceptSummary } from "../types/contracts";

interface ConnectionListProps {
  concepts: ConceptSummary[];
  connections: ConceptConnectionSummary[];
}

export function ConnectionList({ concepts, connections }: ConnectionListProps) {
  const titleById = new Map(
    concepts.map((concept) => [concept.id, concept.title]),
  );

  return (
    <section className="card-panel">
      <h2>Connections</h2>
      <ul className="connection-list">
        {connections.map((connection) => (
          <li key={connection.id}>
            <strong>
              {titleById.get(connection.sourceConceptId) ??
                connection.sourceConceptId}
            </strong>{" "}
            {connection.relationVerb}{" "}
            <strong>
              {titleById.get(connection.targetConceptId) ??
                connection.targetConceptId}
            </strong>
            {connection.rationale ? ` - ${connection.rationale}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
