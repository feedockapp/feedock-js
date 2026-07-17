import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { secondaryText, surfaceBorder } from "../lib/surface";

/** The centered "Load more" control shared by the board + changelog lists. */
export function loadMoreStyles(theme: ResolvedTheme) {
  return {
    wrap: {
      display: "flex",
      justifyContent: "center",
      padding: "12px 0 2px",
    } as CSSProperties,
    button: (hover: boolean, disabled: boolean): CSSProperties => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 30,
      padding: "0 14px",
      borderRadius: 8,
      border: `1px solid ${surfaceBorder(theme, hover && !disabled)}`,
      background: "transparent",
      color: hover && !disabled ? theme.text : secondaryText(theme),
      fontSize: 12.5,
      fontWeight: 500,
      fontFamily: "inherit",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.6 : 1,
      transition: "color 0.12s ease, border-color 0.12s ease",
    }),
  };
}
