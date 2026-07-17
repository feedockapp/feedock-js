import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";

/**
 * Inline-style map for one picked-but-not-yet-uploaded file pill: an optional
 * image thumbnail, the file name (truncating), its size, and a remove button.
 */
export function attachmentPillStyles(theme: ResolvedTheme) {
  return {
    root: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      background: theme.bg,
      padding: "6px 8px",
    } as CSSProperties,
    // Square crop so a portrait and a landscape pick read the same size.
    thumb: {
      width: 28,
      height: 28,
      flexShrink: 0,
      borderRadius: 6,
      objectFit: "cover",
      border: `1px solid ${theme.border}`,
    } as CSSProperties,
    // Takes the slack and truncates — the size + remove button never get pushed
    // out by a long file name.
    name: {
      minWidth: 0,
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: 12,
      color: theme.text,
    } as CSSProperties,
    size: { flexShrink: 0, fontSize: 12, color: theme.muted } as CSSProperties,
    remove: {
      flexShrink: 0,
      border: "none",
      background: "transparent",
      color: theme.muted,
      cursor: "pointer",
      fontSize: 16,
      lineHeight: 1,
    } as CSSProperties,
  };
}
