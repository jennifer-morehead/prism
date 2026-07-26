import { Link } from "react-router-dom";
import { PrismIcon } from "./PrismIcon";

export function HomeLink() {
  return (
    <Link className="home-link" to="/" aria-label="Return to Prism home">
      <PrismIcon />
      <span className="sr-only">Prism home</span>
    </Link>
  );
}
