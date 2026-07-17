import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";

/** Error red, shared with the board's error line. */
const ERROR_FG = "#D33A3F";

/** Inline-style factory for the feedback detail view (Shadow-DOM safe). */
export function feedbackDetailStyles(theme: ResolvedTheme) {
  return {
    back: {
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
    } as CSSProperties,
    // Byline (author + date) leads the detail, like the changelog article.
    byline: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 18,
    } as CSSProperties,
    bylineText: {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    } as CSSProperties,
    bylineName: {
      fontSize: 15,
      fontWeight: 700,
      color: theme.text,
      lineHeight: 1.2,
    } as CSSProperties,
    // `standalone`: no author to sit under, so the date leads the item alone and
    // carries the byline's bottom spacing itself.
    //
    // `textTransform` carries the uppercase the old `formatShortDate` baked into
    // the string — case is presentation, and upper-casing a localized month in
    // JS misbehaves in some locales. See shared/lib/format.
    bylineDate: (standalone = false) =>
      ({
        fontSize: 12.5,
        color: theme.muted,
        marginTop: 2,
        textTransform: "uppercase",
        ...(standalone ? { marginBottom: 16 } : {}),
      }) as CSSProperties,
    title: {
      fontSize: 21,
      fontWeight: 600,
      lineHeight: 1.25,
      color: theme.text,
      margin: 0,
    } as CSSProperties,
    body: {
      fontSize: 14,
      lineHeight: 1.6,
      color: theme.text,
      marginTop: 10,
      wordBreak: "break-word",
    } as CSSProperties,

    // Footer: status (left) · vote pill (right).
    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 20,
    } as CSSProperties,
    // Inline status (colored glyph + plain label) — the app's general treatment;
    // no filled pill, no bold.
    statusPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 13,
      fontWeight: 400,
      color: theme.muted,
    } as CSSProperties,
    statusIcon: (fg: string) =>
      ({ display: "inline-flex", color: fg }) as CSSProperties,
    votePill: (pressed: boolean) =>
      ({
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${pressed ? theme.brand : theme.border}`,
        background: pressed ? theme.subtle : "transparent",
        color: theme.text,
        cursor: "pointer",
        flexShrink: 0,
      }) as CSSProperties,
    voteCaret: { color: theme.brand, display: "inline-flex" } as CSSProperties,
    voteNum: { fontSize: 14, fontWeight: 700 } as CSSProperties,

    // Solid hairline between the item and its comments.
    divider: {
      borderTop: `1px solid ${theme.border}`,
      margin: "28px 0 0",
    } as CSSProperties,

    commentsHead: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: theme.text,
      margin: "24px 0 16px",
    } as CSSProperties,
    commentsCount: {
      color: theme.muted,
      fontWeight: 600,
      letterSpacing: 0,
    } as CSSProperties,
    // The comment ROW's own keys live in feedback-comment-row-styles.ts — it
    // reads them itself rather than being handed this map.

    composer: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 4,
    } as CSSProperties,
    textarea: {
      width: "100%",
      minHeight: 64,
      resize: "vertical",
      padding: "9px 11px",
      borderRadius: 10,
      border: `1px solid ${theme.border}`,
      background: theme.card,
      color: theme.text,
      fontSize: 13.5,
      fontFamily: "inherit",
      boxSizing: "border-box",
    } as CSSProperties,
    postButton: (disabled: boolean) =>
      ({
        alignSelf: "flex-end",
        padding: "7px 16px",
        borderRadius: 999,
        border: "none",
        background: disabled ? theme.subtle : theme.brand,
        color: disabled ? theme.muted : theme.onBrand,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }) as CSSProperties,
    commentError: {
      fontSize: 12.5,
      color: ERROR_FG,
      margin: 0,
    } as CSSProperties,
    muted: { fontSize: 13, color: theme.muted, padding: "16px 0" } as CSSProperties,
  };
}
