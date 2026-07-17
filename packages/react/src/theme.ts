import type { FeedbackStatus } from "./types";

/** Resolved color tokens the components render with (inline styles, no CSS). */
export interface ResolvedTheme {
  /** The mode the palette was resolved to — "auto" never survives resolution. */
  mode: "light" | "dark";
  brand: string;
  onBrand: string;
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
}

// Azure-blue brand accent. Founders override via brandColor/data-brand-color.
const DEFAULT_BRAND = "#3E90F0";

// Cool near-black (#141718) base, with a subtle elevation hierarchy above it.
const DARK: Omit<ResolvedTheme, "mode" | "brand" | "onBrand"> = {
  bg: "#141718",
  card: "#1D2023",
  border: "#26292E",
  text: "#F3F3F3",
  muted: "#8692A6",
  subtle: "#222529",
};

const LIGHT: Omit<ResolvedTheme, "mode" | "brand" | "onBrand"> = {
  bg: "#FCFCFC",
  card: "#FFFFFF",
  border: "#E6E8EC",
  text: "#1E1E1E",
  muted: "#696F79",
  subtle: "#F1F4F9",
};

/**
 * The readable text/glyph color to place ON the brand fill — dark ink on a light
 * brand, white on a dark one. A founder can set any brand color, so a fixed
 * white gave unreadable buttons on a pale accent.
 */
function onBrandColor(brand: string): string {
  const hex = brand.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) {
    return "#ffffff"; // unparseable (e.g. a CSS name) — keep the old default
  }
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Perceived (Rec. 601) luminance; > ~55% reads as a light fill.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#111111" : "#ffffff";
}

/** Resolve the palette from the requested mode + brand color. */
export function resolveTheme(
  mode: "light" | "dark",
  brandColor?: string | null,
): ResolvedTheme {
  const base = mode === "dark" ? DARK : LIGHT;
  const brand = brandColor || DEFAULT_BRAND;
  return {
    mode,
    brand,
    onBrand: onBrandColor(brand),
    ...base,
  };
}

/** Tone (text + translucent background) per user-facing status. */
export function statusTone(status: FeedbackStatus): {
  fg: string;
  bg: string;
  label: string;
} {
  const tones: Record<FeedbackStatus, { fg: string; label: string }> = {
    Open: { fg: "#8692A6", label: "Pending" },
    UnderReview: { fg: "#41ABFF", label: "Reviewing" },
    Planned: { fg: "#3E90F0", label: "Planned" },
    InProgress: { fg: "#FFB946", label: "In progress" },
    Shipped: { fg: "#2ED47A", label: "Shipped" },
    Declined: { fg: "#D74643", label: "Declined" },
  };
  // Fall back to Open for a status this SDK version doesn't know — an older SDK
  // against a newer API would otherwise read `undefined.fg` and crash every card
  // it renders. StatusIcon guards the same way.
  const tone = tones[status] ?? tones.Open;
  return { fg: tone.fg, bg: `${tone.fg}22`, label: tone.label };
}
