import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";

/** Inline-style map for the SDK identity prompt, parameterized by the theme. */
export function identityPromptStyles(theme: ResolvedTheme): {
  root: CSSProperties;
  helpText: CSSProperties;
  input: CSSProperties;
  actions: CSSProperties;
  primaryButton: (busy: boolean) => CSSProperties;
  secondaryButton: CSSProperties;
  sentText: CSSProperties;
  error: CSSProperties;
} {
  const primaryButton = (busy: boolean): CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: theme.brand,
    color: theme.onBrand,
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.7 : 1,
  });

  return {
    root: {
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      background: theme.subtle,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    helpText: { fontSize: 13, color: theme.muted },
    input: {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 8,
      border: `1px solid ${theme.border}`,
      background: theme.bg,
      color: theme.text,
      fontSize: 14,
      boxSizing: "border-box",
    },
    actions: { display: "flex", gap: 8 },
    primaryButton,
    secondaryButton: {
      ...primaryButton(false),
      background: "transparent",
      color: theme.muted,
      fontWeight: 500,
    },
    sentText: { fontSize: 13, color: theme.text },
    error: { fontSize: 12, color: "#D33A3F" },
  };
}
