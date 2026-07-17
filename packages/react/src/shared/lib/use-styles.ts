"use client";

import { useMemo } from "react";

import { useFeedockContext } from "../../context";
import type { ResolvedTheme } from "../../theme";

/**
 * Resolve a component's inline-style map from the active theme, memoized.
 *
 * The SDK renders with inline styles (no stylesheet — the widget mounts us in a
 * Shadow DOM a global sheet can't reach), so every component builds a fresh
 * `CSSProperties` map on each render unless something memoizes it. This is that
 * something, and it is the ONE place that does it.
 *
 * The signature is the point. `factory` takes the theme and nothing else, so
 * "this style map is a function of the theme alone" stops being a review comment
 * and becomes a type error: a factory that wants hover/active/index state simply
 * won't fit. Per-state variation stays where it belongs — a function INSIDE the
 * returned map (`styles.itemTitle(hover)`), which the theme memo doesn't have to
 * care about. See `features/roadmap/roadmap-styles.ts` for the shape.
 *
 * Pass a MODULE-LEVEL factory. The memo keys on `[factory, theme]`, so a factory
 * defined inline in a component body is a new function every render and the memo
 * never hits (correct, just pointless). Every caller in this package passes an
 * imported top-level function.
 */
export function useStyles<T>(factory: (theme: ResolvedTheme) => T): T {
  const { theme } = useFeedockContext();
  return useMemo(() => factory(theme), [factory, theme]);
}
