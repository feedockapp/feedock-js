"use client";

import { useFeedockContext } from "../../context";

/** "← Back" affordance shared by the roadmap + changelog detail views. */
export function DetailBack({ onBack }: { onBack: () => void }) {
  const { theme } = useFeedockContext();
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
        color: theme.muted,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        marginBottom: 14,
        fontFamily: "inherit",
      }}
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
