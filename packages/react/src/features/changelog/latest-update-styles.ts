import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { clamp } from "./latest-update-text";

/** Inline-style maps for the "What's New" toast, parameterized by theme + hover. */
export function latestUpdateStyles(theme: ResolvedTheme): {
  card: (visible: boolean) => CSSProperties;
  header: CSSProperties;
  closeButton: (hover: boolean) => CSSProperties;
  title: CSSProperties;
  excerpt: CSSProperties;
  cta: (hover: boolean) => CSSProperties;
  ctaArrow: (hover: boolean) => CSSProperties;
} {
  return {
    card: (visible: boolean) => ({
      width: 340,
      maxWidth: "calc(100vw - 40px)",
      boxSizing: "border-box",
      // `bg`, not `card` — the toast sits BESIDE the widget panel rather than
      // inside it, so it takes the panel's own surface color (identical to the
      // widget shell's `panelBg`). `card` is the elevated tone for things
      // stacked on top of a surface, and it read as a lighter floating slab.
      background: theme.bg,
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: 16,
      boxShadow: "0 12px 40px rgba(0,0,0,0.24)",
      padding: 16,
      fontFamily:
        "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(10px)",
      transition: "opacity 0.26s ease, transform 0.26s ease",
    }),
    // Title and dismiss share the top row: with the eyebrow gone there's no
    // other row to hang the close button on, and `flex-start` keeps it pinned
    // to the first line when the title wraps to two.
    header: { display: "flex", alignItems: "flex-start", gap: 8 },
    closeButton: (hover: boolean) => ({
      flexShrink: 0,
      // Pull up/right so the glyph optically aligns with the title's cap height
      // and the card's padding edge rather than sitting inset by its own box.
      margin: "-4px -4px 0 0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 26,
      height: 26,
      borderRadius: 8,
      border: "none",
      background: hover ? `${theme.muted}22` : "transparent",
      color: theme.muted,
      fontSize: 16,
      lineHeight: 1,
      cursor: "pointer",
      transition: "background 0.15s ease",
    }),
    title: {
      margin: 0,
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      // Medium, not bold — the eyebrow used to carry the emphasis, and at this
      // size the color/size step against the excerpt is enough hierarchy.
      fontWeight: 500,
      lineHeight: 1.3,
      color: theme.text,
      ...clamp(2),
    },
    excerpt: {
      margin: "4px 0 0",
      fontSize: 13,
      lineHeight: 1.45,
      color: theme.muted,
      ...clamp(2),
    },
    // A text link rather than a filled pill: the toast is an unprompted
    // interruption, so the action reads better as an offer than a demand.
    cta: (hover: boolean) => ({
      marginTop: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: 0,
      border: "none",
      background: "transparent",
      color: theme.brand,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: hover ? "underline" : "none",
      textUnderlineOffset: 3,
      transition: "opacity 0.15s ease",
      opacity: hover ? 0.85 : 1,
    }),
    ctaArrow: (hover: boolean) => ({
      display: "inline-block",
      transform: hover ? "translateX(3px)" : "translateX(0)",
      transition: "transform 0.15s ease",
    }),
  };
}
