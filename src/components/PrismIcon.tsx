import { useId } from "react";

export function PrismIcon() {
  const gradientId = useId();

  return (
    <svg
      className="prism-icon"
      viewBox="0 0 48 42"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="23.5836"
          y1="-0.5"
          x2="23.5837"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.0240385" stopColor="#16C79A" />
          <stop offset="0.95098" stopColor="#8D5CFF" />
        </linearGradient>
      </defs>
      <path
        d="M23.5836 1.5L45.6673 39.75H1.5L23.5836 1.5Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
