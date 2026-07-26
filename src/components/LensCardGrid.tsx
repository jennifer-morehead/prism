import { LensSummary } from "../types/contracts";

interface LensCardGridProps {
  lenses: LensSummary[];
  onSelect: (lensId: string) => void;
}

export function LensCardGrid({ lenses, onSelect }: LensCardGridProps) {
  return (
    <div className="lens-grid">
      {lenses.map((lens) => (
        <button
          key={lens.id}
          type="button"
          className="lens-card"
          onClick={() => onSelect(lens.id)}
        >
          <h2>{lens.name}</h2>
          <p className="lens-description">{lens.description}</p>
          <span className="lens-cta">Use this lens</span>
        </button>
      ))}
    </div>
  );
}
