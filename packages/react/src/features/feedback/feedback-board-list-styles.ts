import type { CSSProperties } from "react";

import { secondaryText } from "../../shared/lib/surface";
import type { ResolvedTheme } from "../../theme";
import { fs } from "../../type-scale";

/**
 * Inline-style map for the board's list area — the empty placeholder and the
 * card stack, which dims (with a corner spinner over it) while a sort/search
 * change refetches.
 */
export function feedbackBoardListStyles(theme: ResolvedTheme) {
  return {
    // theme.muted (not secondaryText) — the SDK's placeholder copy tone.
    empty: {
      fontSize: fs(13),
      // One empty-state gray across every surface — matches Home + Roadmap
      // (secondaryText), not the slightly different theme.muted this used before.
      color: secondaryText(theme),
      padding: "16px 0",
    } as CSSProperties,
    // Positions the refetch spinner over the list without reflowing it.
    root: { position: "relative" } as CSSProperties,
    spinner: {
      position: "absolute",
      top: 0,
      right: 0,
      zIndex: 1,
    } as CSSProperties,
    // Dims while revalidating with data on screen, so the refresh reads without
    // the list ever flashing empty.
    list: (loading = false) =>
      ({
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: loading ? 0.55 : 1,
        transition: "opacity 0.15s ease",
      }) as CSSProperties,
  };
}

export type FeedbackBoardListStyles = ReturnType<
  typeof feedbackBoardListStyles
>;
