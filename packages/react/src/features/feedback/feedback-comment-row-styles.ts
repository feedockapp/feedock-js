import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { fs } from "../../type-scale";

/**
 * Inline-style map for one comment row. Split out of `feedbackDetailStyles`
 * along with the row itself: these six keys had exactly one consumer, and while
 * they lived in the detail's map the row could only get them as a prop — which
 * is what kept it from being memoized.
 */
export function feedbackCommentRowStyles(theme: ResolvedTheme) {
  return {
    root: {
      padding: "16px 0",
      borderTop: `1px solid ${theme.border}`,
    } as CSSProperties,
    meta: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: fs(12.5),
      marginBottom: 4,
    } as CSSProperties,
    author: { fontWeight: 600, color: theme.text } as CSSProperties,
    // Soft brand-tinted chip (filled, not outlined) — the accent tracks the
    // founder's brand color; color-mix keeps the fill a light tint of it.
    officialBadge: {
      fontSize: fs(10.5),
      fontWeight: 600,
      letterSpacing: 0.3,
      color: theme.brand,
      background: `color-mix(in srgb, ${theme.brand} 16%, transparent)`,
      borderRadius: 6,
      padding: "2px 7px",
    } as CSSProperties,
    // `textTransform` carries the uppercase the old `formatShortDate` baked into
    // the string — case is presentation, and upper-casing a localized month in
    // JS misbehaves in some locales. See shared/lib/format.
    time: {
      fontSize: fs(12),
      color: theme.muted,
      textTransform: "uppercase",
    } as CSSProperties,
    body: {
      fontSize: fs(13.5),
      lineHeight: 1.5,
      color: theme.text,
    } as CSSProperties,
  };
}
