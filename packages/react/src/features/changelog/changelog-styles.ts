import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";

/**
 * Inline-style map for the SDK's "What's New" feed — the stacked entry list and
 * the divider between entries. Self-contained (no stylesheet) so the widget can
 * render it inside a Shadow DOM.
 */
export function changelogStyles(theme: ResolvedTheme) {
  return {
    root: {
      background: theme.bg,
      color: theme.text,
      fontFamily:
        "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    } as CSSProperties,
    /** The error + "no updates yet" lines. */
    message: { fontSize: 13, color: theme.muted } as CSSProperties,
    /* A full-width divider BETWEEN entries — the primary separator, matching the
       Home tab's group divider. */
    groupDivider: {
      height: 1,
      flexShrink: 0,
      background:
        theme.mode === "dark" ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.10)",
    } as CSSProperties,
  };
}
