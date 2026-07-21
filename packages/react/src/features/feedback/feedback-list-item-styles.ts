import type { CSSProperties } from "react";

import {
  primaryText,
  secondaryText,
  surfaceBg,
  surfaceBorder,
} from "../../shared/lib/surface";
import type { ResolvedTheme } from "../../theme";

/**
 * Inline-style map for one SDK feedback card: a padded content column (title +
 * excerpt over a single meta row — comment count · divider · status) beside a
 * full-height vote column split off by a hairline. The status is inline text
 * with only its glyph colored (no pill).
 */
export function feedbackListItemStyles(theme: ResolvedTheme) {
  const dark = theme.mode === "dark";
  // Deliberately NOT surfaceBorder(): the vote column's split is a touch
  // stronger than the card's own hairline on dark (0.08 vs 0.06).
  const hairline = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  return {
    // Border brightens on hover (the shared hover affordance).
    root: (hover = false) =>
      ({
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        borderRadius: 16,
        border: `1px solid ${surfaceBorder(theme, hover)}`,
        background: surfaceBg(theme),
        transition: "border-color 0.12s ease",
      }) as CSSProperties,
    // The card body is a button (opens the detail) — only a pointer when it
    // actually opens something.
    content: (clickable = false) =>
      ({
        flex: 1,
        minWidth: 0,
        display: "block",
        padding: 14,
        textAlign: "left",
        border: "none",
        background: "transparent",
        cursor: clickable ? "pointer" : "default",
        fontFamily: "inherit",
      }) as CSSProperties,
    title: {
      fontSize: 14,
      fontWeight: 400,
      color: primaryText(theme),
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    } as CSSProperties,
    body: {
      marginTop: 3,
      fontSize: 13,
      lineHeight: 1.5,
      color: secondaryText(theme),
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    } as CSSProperties,
    // One line: comments + status stay fixed; the board + author names shrink
    // (truncate) so everything fits without wrapping.
    meta: {
      marginTop: 10,
      display: "flex",
      alignItems: "center",
      flexWrap: "nowrap",
      gap: 8,
      minWidth: 0,
      overflow: "hidden",
      fontSize: 12,
      color: secondaryText(theme),
    } as CSSProperties,
    metaItem: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    } as CSSProperties,
    // The status half of the meta row: [divider][colored glyph][label]. Grouped
    // so the label stays with its divider; fixed-width (never shrinks).
    statusMeta: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      whiteSpace: "nowrap",
      flexShrink: 0,
    } as CSSProperties,
    metaDivider: {
      width: 1,
      height: 11,
      flexShrink: 0,
      background: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)",
    } as CSSProperties,
    // Only the glyph carries the status tone (`statusTone(status).fg`).
    statusMetaIcon: (fg: string) =>
      ({ display: "inline-flex", color: fg }) as CSSProperties,
    // The board + author groups shrink (their names truncate) so the row stays
    // on one line. minWidth:0 lets the child text ellipsize below its content.
    metaShrink: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
      flexShrink: 1,
    } as CSSProperties,
    boardName: {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } as CSSProperties,
    authorName: {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } as CSSProperties,
    voteColumn: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      width: 54,
      flexShrink: 0,
      alignSelf: "stretch",
      border: "none",
      borderLeft: `1px solid ${hairline}`,
      background: "transparent",
      color: theme.text,
      cursor: "pointer",
      fontFamily: "inherit",
    } as CSSProperties,
    voteArrow: { color: theme.brand, display: "flex" } as CSSProperties,
    voteCount: {
      fontSize: 14,
      fontWeight: 400,
      color: primaryText(theme),
    } as CSSProperties,
  };
}

export type FeedbackListItemStyles = ReturnType<typeof feedbackListItemStyles>;
