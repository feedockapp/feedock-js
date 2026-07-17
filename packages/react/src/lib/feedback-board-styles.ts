import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../theme";
import { surfaceBg, surfaceBorder } from "./surface";

const BOARD_FONT =
  "'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/** Shared height for the header controls (search field + Top/New + New post). */
const CONTROL_H = 32;

/**
 * Board root. `fill` (panel embeds like the widget) makes it a full-height flex
 * column so its header can pin and only the list scrolls; the default is the
 * self-sizing, gap-stacked layout the consumer pads.
 */
export function feedbackRootStyle(
  theme: ResolvedTheme,
  fill: boolean,
): CSSProperties {
  return {
    background: theme.bg,
    color: theme.text,
    fontFamily: BOARD_FONT,
    display: "flex",
    flexDirection: "column",
    ...(fill ? { flex: 1, minHeight: 0 } : { gap: 12 }),
  };
}

/** Fill mode: the pinned header (search + sort), padded, non-scrolling. */
export function feedbackHeaderSectionStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "16px 16px 12px",
    flexShrink: 0,
  };
}

/** Fill mode: the scrolling list region (the scrollbar sits beside the list). */
export function feedbackListScrollStyle(): CSSProperties {
  return {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    // Always reserve the scrollbar gutter and trim the right pad by its width, so
    // the cards' right edge lines up with the scrollbar-less header row above.
    scrollbarGutter: "stable",
    padding: "0 6px 16px 16px",
  };
}

/** Fill mode: a padded scroll region for the detail view / identity gate. */
export function feedbackFillSectionStyle(): CSSProperties {
  return { flex: 1, minHeight: 0, overflowY: "auto", padding: 16 };
}

/**
 * The Top/New sort control — a segmented pill (matches the portal's SortTabs):
 * one rounded track holding both options, the active one lifted like a card.
 */
export function feedbackSortGroupStyle(theme: ResolvedTheme): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    height: CONTROL_H,
    padding: 3,
    boxSizing: "border-box",
    borderRadius: 999,
    // Same recessed surface + hairline border as the search field and cards; the
    // active segment (theme.card) reads as lifted above it.
    background: surfaceBg(theme),
    border: `1px solid ${surfaceBorder(theme)}`,
    flexShrink: 0,
  };
}

/** One segment; the active one is a lifted card, inactive is muted + hoverable. */
export function feedbackSortItemStyle(
  theme: ResolvedTheme,
  active: boolean,
  hover = false,
): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: "100%",
    padding: "0 12px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    background: active ? theme.card : "transparent",
    color: active || hover ? theme.text : theme.muted,
    boxShadow: active
      ? theme.mode === "dark"
        ? "0 1px 2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.06)"
        : "0 1px 2px rgba(0,0,0,0.1)"
      : "none",
    transition: "color 0.12s ease, background 0.12s ease",
  };
}

/** Style for the "New post" composer-entry button. */
export function feedbackNewPostStyle(theme: ResolvedTheme): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: CONTROL_H,
    padding: "0 14px",
    boxSizing: "border-box",
    borderRadius: 8,
    border: "none",
    background: theme.brand,
    color: theme.onBrand,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  };
}

/** The search field wrapper (relative, so the magnifier icon can sit inside). */
export function feedbackSearchWrapStyle(): CSSProperties {
  return { position: "relative", flex: 1, minWidth: 150 };
}

/** The search input itself — pill, with room on the left for the icon. */
export function feedbackSearchInputStyle(
  theme: ResolvedTheme,
  hover = false,
  focus = false,
): CSSProperties {
  return {
    width: "100%",
    height: CONTROL_H,
    padding: "0 12px 0 32px",
    borderRadius: 999,
    // Drop the browser's thick focus ring for a thin brand border on focus; the
    // shared hairline otherwise (brightened a touch on hover). Same surface as the
    // cards + sort control.
    outline: "none",
    border: `1px solid ${focus ? theme.brand : surfaceBorder(theme, hover)}`,
    background: surfaceBg(theme),
    color: theme.text,
    fontSize: 13,
    boxSizing: "border-box",
    transition: "border-color 0.12s ease",
  };
}

/** The magnifier icon absolutely positioned inside the search field. */
export function feedbackSearchIconStyle(theme: ResolvedTheme): CSSProperties {
  return {
    position: "absolute",
    left: 11,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    color: theme.muted,
    pointerEvents: "none",
  };
}
