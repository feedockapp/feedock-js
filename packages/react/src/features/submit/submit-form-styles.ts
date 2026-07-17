import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";

/** Inline-style map for the SDK composer, parameterized by the resolved theme. */
export function submitFormStyles(theme: ResolvedTheme): {
  root: (shown: boolean) => CSSProperties;
  field: CSSProperties;
  textarea: CSSProperties;
  attachButton: CSSProperties;
  postButton: (busy: boolean) => CSSProperties;
  cancelButton: CSSProperties;
  actions: CSSProperties;
  hiddenFileInput: CSSProperties;
  notifyRow: CSSProperties;
  notifyCheckbox: (checked: boolean) => CSSProperties;
  error: CSSProperties;
  suggestions: CSSProperties;
  suggestionsTitle: CSSProperties;
  suggestionRow: CSSProperties;
  suggestionText: CSSProperties;
  suggestionVote: (voted: boolean) => CSSProperties;
} {
  const field: CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.text,
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const secondaryButton: CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: "transparent",
    color: theme.text,
    fontSize: 13,
    cursor: "pointer",
  };

  return {
    root: (shown: boolean) => ({
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      background: theme.card,
      padding: 14,
      opacity: shown ? 1 : 0,
      transform: shown ? "translateY(0)" : "translateY(-6px)",
      transition: "opacity 0.2s ease, transform 0.2s ease",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }),
    field,
    textarea: { ...field, resize: "vertical" },
    attachButton: { ...secondaryButton, alignSelf: "flex-start" },
    postButton: (busy: boolean) => ({
      padding: "8px 12px",
      borderRadius: 8,
      border: "none",
      background: theme.brand,
      color: theme.onBrand,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      opacity: busy ? 0.7 : 1,
    }),
    cancelButton: {
      padding: "8px 12px",
      borderRadius: 8,
      border: "none",
      background: "transparent",
      color: theme.muted,
      fontSize: 14,
      cursor: "pointer",
    },
    actions: { display: "flex", gap: 8 },
    hiddenFileInput: { display: "none" },
    notifyRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      color: theme.muted,
      cursor: "pointer",
    },
    // Round custom checkbox — fills with the brand color once ticked.
    notifyCheckbox: (checked: boolean) => ({
      width: 16,
      height: 16,
      flexShrink: 0,
      padding: 0,
      borderRadius: "50%",
      cursor: "pointer",
      border: `1px solid ${checked ? theme.brand : theme.border}`,
      background: checked ? theme.brand : "transparent",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    }),
    error: { fontSize: 12, color: "#D33A3F" },
    suggestions: {
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      background: theme.bg,
      padding: 10,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    suggestionsTitle: {
      fontSize: 12,
      fontWeight: 600,
      color: theme.muted,
    },
    suggestionRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    suggestionText: {
      fontSize: 13,
      color: theme.text,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    suggestionVote: (voted: boolean) => ({
      flexShrink: 0,
      padding: "4px 10px",
      borderRadius: 6,
      border: `1px solid ${voted ? theme.brand : theme.border}`,
      background: voted ? theme.brand : "transparent",
      color: voted ? theme.onBrand : theme.text,
      fontSize: 12,
      fontWeight: 600,
      cursor: voted ? "default" : "pointer",
    }),
  };
}
