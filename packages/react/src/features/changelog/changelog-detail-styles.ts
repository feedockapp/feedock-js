import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { primaryText, secondaryText } from "../../shared/lib/surface";

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
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.brand,
    } as CSSProperties,
    title: {
      margin: "8px 0 0",
      fontSize: 20,
      fontWeight: 500,
      lineHeight: 1.25,
      color: primaryText(theme),
    } as CSSProperties,
    whyItMatters: {
      margin: "6px 0 0",
      fontSize: 14,
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
      fontSize: 12.5,
      color: secondaryText(theme),
    } as CSSProperties,
    // The name lifts out of the byline's secondary tone.
    authorName: { color: primaryText(theme) } as CSSProperties,
    body: {
      marginTop: 14,
      fontSize: 14,
      lineHeight: 1.6,
      color: theme.text,
      wordBreak: "break-word",
    } as CSSProperties,
  };
}
