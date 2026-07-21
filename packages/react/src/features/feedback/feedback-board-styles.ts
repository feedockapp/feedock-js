import type { CSSProperties } from "react";

import { surfaceBg, surfaceBorder } from "../../shared/lib/surface";
import type { ResolvedTheme } from "../../theme";

const BOARD_FONT =
  "'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/** Shared height for the header controls (search field + Top/New + New post). */
const CONTROL_H = 32;

/** Error red, shared with the detail's comment error. */
const ERROR_FG = "#D33A3F";

/**
 * Inline-style map for the feedback board's own chrome (root, header row, search
 * field, sort segments, "New post"). One factory of the theme, like every other
 * surface — the per-state bits (`root(fill)`, `sortItem(active, hover)`,
 * `searchInput(hover, focus)`) are functions inside the map, so the map itself
 * stays a function of the theme alone and memoizes. See shared/lib/use-styles.
 */
export function feedbackBoardStyles(theme: ResolvedTheme) {
  return {
    /**
     * `fill` (panel embeds like the widget) makes the root a full-height flex
     * column so its header can pin and only the list scrolls; the default is the
     * self-sizing, gap-stacked layout the consumer pads.
     */
    root: (fill: boolean) =>
      ({
        background: theme.bg,
        color: theme.text,
        fontFamily: BOARD_FONT,
        display: "flex",
        flexDirection: "column",
        ...(fill ? { flex: 1, minHeight: 0 } : { gap: 12 }),
      }) as CSSProperties,

    /** Fill mode: the pinned header (search + sort), padded, non-scrolling. */
    headerSection: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      padding: "16px 16px 12px",
      flexShrink: 0,
    } as CSSProperties,

    /** Fill mode: the scrolling list region (the scrollbar sits beside the list). */
    listScroll: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      // Always reserve the scrollbar gutter and trim the right pad by its width, so
      // the cards' right edge lines up with the scrollbar-less header row above.
      scrollbarGutter: "stable",
      padding: "0 6px 16px 16px",
    } as CSSProperties,

    /** Fill mode: a padded scroll region for the detail view / identity gate. */
    fillSection: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      padding: 16,
    } as CSSProperties,

    /**
     * The identity gate's wrapper. Only fill mode pads/pins it — the self-sizing
     * layout lets the gate sit in the root's own gap stack, hence `undefined`.
     */
    gateSection: (fill: boolean): CSSProperties | undefined =>
      fill ? { padding: "16px 16px 0", flexShrink: 0 } : undefined,

    /** The header's control row (search + sort + New post), wrapping when narrow. */
    headerRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    } as CSSProperties,

    /** The board-level (list/fetch) error line. */
    error: { fontSize: 13, color: ERROR_FG } as CSSProperties,

    /**
     * The Top/New sort control — a segmented pill (matches the portal's SortTabs):
     * one rounded track holding both options, the active one lifted like a card.
     */
    sortGroup: {
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
    } as CSSProperties,

    /** One segment; the active one is a lifted card, inactive is muted + hoverable. */
    sortItem: (active: boolean, hover = false) =>
      ({
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
      }) as CSSProperties,

    /** The "New post" composer-entry button. */
    newPost: {
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
    } as CSSProperties,

    /** The search field wrapper (relative, so the magnifier icon can sit inside). */
    searchWrap: {
      position: "relative",
      flex: 1,
      minWidth: 150,
    } as CSSProperties,

    /** The search input itself — pill, with room on the left for the icon. */
    searchInput: (hover = false, focus = false) =>
      ({
        width: "100%",
        height: CONTROL_H,
        padding: "0 12px 0 32px",
        borderRadius: 999,
        // Drop the browser's thick focus ring for a thin brand border on focus; the
        // shared hairline otherwise (brightened a touch on hover). Same surface as
        // the cards + sort control.
        outline: "none",
        border: `1px solid ${focus ? theme.brand : surfaceBorder(theme, hover)}`,
        background: surfaceBg(theme),
        color: theme.text,
        fontSize: 13,
        boxSizing: "border-box",
        transition: "border-color 0.12s ease",
      }) as CSSProperties,

    /** The magnifier icon absolutely positioned inside the search field. */
    searchIcon: {
      position: "absolute",
      left: 11,
      top: "50%",
      transform: "translateY(-50%)",
      display: "flex",
      color: theme.muted,
      pointerEvents: "none",
    } as CSSProperties,
  };
}
