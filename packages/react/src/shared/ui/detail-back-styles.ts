import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { fs } from "../../type-scale";

/** Inline-style map for the shared "← Back" affordance. */
export function detailBackStyles(theme: ResolvedTheme) {
  return {
    root: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: fs(13),
      fontWeight: 600,
      color: theme.muted,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: 0,
      marginBottom: 14,
      fontFamily: "inherit",
    } as CSSProperties,
  };
}
