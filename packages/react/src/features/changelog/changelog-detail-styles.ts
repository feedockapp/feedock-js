import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { primaryText, secondaryText } from "../../shared/lib/surface";
import { fs } from "../../type-scale";

const ERROR_FG = "#D33A3F";

/**
 * Inline-style map for one published update rendered as an article — category
 * eyebrow, title, why-it-matters lede, byline, body. Shares the panel's tokens
 * (softened-white title, neutral secondary text).
 */
export function changelogDetailStyles(theme: ResolvedTheme) {
  return {
    /* The category leads the article, above the title. */
    eyebrow: {
      marginTop: 12,
      fontSize: fs(11),
      fontWeight: 600,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.brand,
    } as CSSProperties,
    title: {
      margin: "8px 0 0",
      fontSize: fs(20),
      fontWeight: 500,
      lineHeight: 1.25,
      color: primaryText(theme),
    } as CSSProperties,
    whyItMatters: {
      margin: "6px 0 0",
      fontSize: fs(14),
      lineHeight: 1.5,
      color: secondaryText(theme),
    } as CSSProperties,
    /* Byline: author · date. */
    byline: {
      marginTop: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      fontSize: fs(12.5),
      color: secondaryText(theme),
    } as CSSProperties,
    // The name lifts out of the byline's secondary tone.
    authorName: { color: primaryText(theme) } as CSSProperties,
    body: {
      marginTop: 14,
      fontSize: fs(14),
      lineHeight: 1.6,
      color: theme.text,
      wordBreak: "break-word",
    } as CSSProperties,

    /* --- Comment thread (mirrors feedback-detail-styles) ------------------- */
    divider: {
      borderTop: `1px solid ${theme.border}`,
      margin: "28px 0 0",
    } as CSSProperties,
    commentsHead: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: fs(12),
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
      fontSize: fs(13.5),
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
        fontSize: fs(13),
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }) as CSSProperties,
    commentError: {
      fontSize: fs(12.5),
      color: ERROR_FG,
      margin: 0,
    } as CSSProperties,
    muted: {
      fontSize: fs(13),
      color: theme.muted,
      padding: "12px 0",
    } as CSSProperties,
  };
}
