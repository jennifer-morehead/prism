import { LensSummary } from "../types/contracts";

interface LensCardGridProps {
  lenses: LensSummary[];
  onSelect: (lensId: string) => void;
}

export function LensCardGrid({ lenses, onSelect }: LensCardGridProps) {
  return (
    <div className="lens-grid">
      {lenses.slice(0, 4).map((lens) => (
        <button
          key={lens.id}
          type="button"
          className="lens-card"
          disabled={lens.displayOrder !== lenses[0]?.displayOrder}
          onClick={() => onSelect(lens.id)}
        >
          <span className="lens-card-content">
            <h2>{lens.name}</h2>
            <p className="lens-description">{lens.description}</p>
            {lens.displayOrder === lenses[0]?.displayOrder ? (
              <span className="lens-cta">
                Refract lens <span aria-hidden="true">→</span>
              </span>
            ) : (
              <span className="lens-cta lens-cta-disabled availability-copy">
                Available in full Prism
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
