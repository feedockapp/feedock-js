import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../theme";
import { primaryText, secondaryText, surfaceBorder } from "./surface";

/**
 * Inline-style factory for the curated Home tab (no stylesheet; Shadow-DOM safe).
 * Shares the Feedback tab's tokens: the recessed surface + hairline border, the
 * softened-white title/counts, the neutral secondary text, and a colored status
 * glyph over a neutral label.
 */
export function homeStyles(theme: ResolvedTheme) {
  const dark = theme.mode === "dark";
  return {
    container: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
    } as CSSProperties,

    /* A full-width divider BETWEEN groups (hero + each section) — the primary
       separator, stronger than the hairline between rows inside a group. */
    groupDivider: {
      height: 1,
      flexShrink: 0,
      background: dark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.10)",
    } as CSSProperties,

    /* ---- latest-update hero (full-width, no card chrome) ---- */
    hero: {
      display: "block",
      width: "100%",
      textAlign: "left",
      border: "none",
      borderRadius: 0,
      padding: 0,
      background: "transparent",
      color: "inherit",
      font: "inherit",
      cursor: "pointer",
    } as CSSProperties,
    heroEyebrow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.brand,
    } as CSSProperties,
    heroEyebrowDate: {
      color: secondaryText(theme),
      fontWeight: 500,
    } as CSSProperties,
    heroAuthor: {
      marginTop: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
      minWidth: 0,
    } as CSSProperties,
    heroAuthorName: {
      fontSize: 12.5,
      color: secondaryText(theme),
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } as CSSProperties,
    // Brightens to the full text tone on hover (the shared tappable affordance).
    heroTitle: (hover = false) =>
      ({
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1.25,
        color: hover ? theme.text : primaryText(theme),
        margin: "10px 0 0",
        transition: "color 0.12s ease",
      }) as CSSProperties,
    heroExcerpt: {
      fontSize: 13,
      lineHeight: 1.5,
      color: secondaryText(theme),
      margin: "8px 0 0",
    } as CSSProperties,

    /* ---- section ---- */
    sectionHead: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    } as CSSProperties,
    sectionTitleWrap: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: secondaryText(theme),
    } as CSSProperties,
    sectionIcon: { display: "inline-flex" } as CSSProperties,
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    } as CSSProperties,
    // Brightens to the primary tone on hover (matches the nav's color-brighten).
    seeAll: (hover = false) =>
      ({
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 12,
        color: hover ? theme.text : secondaryText(theme),
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        transition: "color 0.12s ease",
      }) as CSSProperties,

    /* ---- rows ---- */
    // A softer hairline BETWEEN rows only (lighter than the group divider so the
    // group reads as one unit) — the first row has none, so no line under the header.
    row: (first: boolean) =>
      ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "11px 0",
        background: "transparent",
        border: "none",
        borderTop: first
          ? "none"
          : `1px solid ${dark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)"}`,
        textAlign: "left",
        cursor: "pointer",
      }) as CSSProperties,
    rowMain: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2,
    } as CSSProperties,
    // Brightens on hover (the shared color-brighten affordance).
    rowTitle: (hover = false) =>
      ({
        fontSize: 13.5,
        fontWeight: 400,
        color: hover ? theme.text : primaryText(theme),
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        transition: "color 0.12s ease",
      }) as CSSProperties,
    rowSub: {
      fontSize: 12,
      color: secondaryText(theme),
      marginTop: 2,
    } as CSSProperties,
    updateDate: {
      fontSize: 12,
      fontWeight: 400,
      color: secondaryText(theme),
      width: 48,
      flexShrink: 0,
    } as CSSProperties,

    /* ---- vote pill + status glyph ---- */
    votePill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: "3px 9px",
      borderRadius: 999,
      border: `1px solid ${surfaceBorder(theme)}`,
      fontSize: 12,
      fontWeight: 400,
      color: primaryText(theme),
      flexShrink: 0,
    } as CSSProperties,
    // The status glyph slot — only the icon carries the status color. Top-aligned
    // (+ a hair of margin) so it sits with the title, not centered on both lines.
    statusIcon: (color: string) =>
      ({
        display: "inline-flex",
        color,
        flexShrink: 0,
        alignSelf: "flex-start",
        marginTop: 2,
      }) as CSSProperties,

    empty: {
      fontSize: 12.5,
      color: secondaryText(theme),
      padding: "6px 0",
    } as CSSProperties,
  };
}
