"use client";

import { useFeedockContext } from "../../context";

type Props = {
  /** Diameter in px (default 22). */
  size?: number;
  /** Stroke color; defaults to the theme's muted foreground. */
  color?: string;
};

/**
 * A small indeterminate loading spinner. Pure SVG spun by a SMIL
 * `animateTransform` — no CSS `@keyframes` (those don't cross the widget's
 * Shadow DOM boundary) and no `motion` dependency, so it animates identically
 * in a plain React host and inside the embedded widget. Used wherever a surface
 * is (re)fetching: board / roadmap / changelog / detail / home.
 */
export function Spinner({ size = 22, color }: Props) {
  const { theme } = useFeedockContext();
  const stroke = color ?? theme.muted;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={stroke}
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.7s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

/** A centered spinner for first-load / empty-state placeholders. */
export function SpinnerBlock({ size }: { size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 0",
      }}
    >
      <Spinner size={size} />
    </div>
  );
}
