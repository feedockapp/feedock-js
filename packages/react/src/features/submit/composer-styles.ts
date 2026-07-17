import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";

/** Inline-style factory for the full-panel "Give feedback" composer. */
export function composerStyles(theme: ResolvedTheme) {
  return {
    root: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
    } as CSSProperties,
    // The email-confirm step (shown only after Post on an unverified visitor):
    // centered in the panel so the short form doesn't float at the top over a
    // large empty space.
    gateWrap: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      height: "100%",
      minHeight: 0,
    } as CSSProperties,
    scroll: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    } as CSSProperties,
    // Seamless title: no box, just a large heading input.
    title: {
      width: "100%",
      border: "none",
      background: "transparent",
      color: theme.text,
      fontSize: 18,
      fontWeight: 700,
      outline: "none",
      padding: 0,
      fontFamily: "inherit",
    } as CSSProperties,
    // Seamless body: grows to fill, no box.
    body: {
      width: "100%",
      flex: 1,
      minHeight: 120,
      resize: "none",
      border: "none",
      background: "transparent",
      color: theme.text,
      fontSize: 14.5,
      lineHeight: 1.55,
      outline: "none",
      padding: 0,
      fontFamily: "inherit",
    } as CSSProperties,
    notifyRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      color: theme.muted,
      cursor: "pointer",
    } as CSSProperties,
    // Bottom toolbar: attach on the left, Post on the right.
    toolbar: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      paddingTop: 12,
      marginTop: 8,
      borderTop: `1px solid ${theme.border}`,
      flexShrink: 0,
    } as CSSProperties,
    iconButton: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 9,
      border: `1px solid ${theme.border}`,
      background: theme.card,
      color: theme.muted,
      cursor: "pointer",
    } as CSSProperties,
    post: (disabled: boolean) =>
      ({
        marginLeft: "auto",
        padding: "8px 20px",
        borderRadius: 999,
        border: "none",
        background: disabled ? theme.subtle : theme.brand,
        color: disabled ? theme.muted : theme.onBrand,
        fontSize: 13.5,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }) as CSSProperties,
    error: { fontSize: 12.5, color: "#D33A3F" } as CSSProperties,
  };
}
