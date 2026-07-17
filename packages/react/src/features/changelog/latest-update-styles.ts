import type { CSSProperties } from "react";

import type { ResolvedTheme } from "../../theme";
import { clamp } from "./latest-update-text";

/** Inline-style maps for the "What's New" toast, parameterized by theme + hover. */
export function latestUpdateStyles(theme: ResolvedTheme): {
  card: (visible: boolean) => CSSProperties;
  eyebrow: CSSProperties;
  icon: CSSProperties;
  label: CSSProperties;
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
      background: theme.card,
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
    eyebrow: { display: "flex", alignItems: "center", gap: 7 },
    icon: { flexShrink: 0 },
    label: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.brand,
    },
    closeButton: (hover: boolean) => ({
      marginLeft: "auto",
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
      margin: "10px 0 0",
      fontSize: 15,
      fontWeight: 700,
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
    cta: (hover: boolean) => ({
      marginTop: 14,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      background: theme.brand,
      color: theme.onBrand,
      borderRadius: 9999,
      padding: "9px 18px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: hover
        ? `0 6px 18px ${theme.brand}55`
        : `0 2px 8px ${theme.brand}33`,
      filter: hover ? "brightness(1.06)" : "none",
      transition: "filter 0.15s ease, box-shadow 0.15s ease",
    }),
    ctaArrow: (hover: boolean) => ({
      display: "inline-block",
      transform: hover ? "translateX(3px)" : "translateX(0)",
      transition: "transform 0.15s ease",
    }),
  };
}
