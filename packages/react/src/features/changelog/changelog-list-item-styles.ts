import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { clamp } from "./latest-update-text";
import { primaryText, secondaryText } from "../../shared/lib/surface";

/**
 * Inline-style map for one row of the "What's New" list — the category · date
 * eyebrow, the title, the two-line excerpt, and the author name. Shares the
 * feed's tokens (brand eyebrow, softened-white title, neutral secondary text).
 */
export function changelogListItemStyles(theme: ResolvedTheme) {
  return {
    /* Eyebrow: category + date (no pill), matching the Home hero. */
    category: {
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.brand,
    } as CSSProperties,
    date: {
      fontSize: 11,
      fontWeight: 500,
      color: secondaryText(theme),
    } as CSSProperties,
    // Brightens on hover (the shared color-brighten click affordance).
    title: (hover = false) =>
      ({
        margin: "8px 0 0",
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.3,
        color: hover ? theme.text : primaryText(theme),
        transition: "color 0.12s ease",
      }) as CSSProperties,
    excerpt: {
      margin: "6px 0 0",
      fontSize: 13,
      lineHeight: 1.5,
      color: secondaryText(theme),
      ...clamp(2),
    } as CSSProperties,
    authorName: {
      fontSize: 12.5,
      color: secondaryText(theme),
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } as CSSProperties,
  };
}
