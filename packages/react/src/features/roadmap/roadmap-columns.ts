import type { RoadmapColumn } from "../../types";

/**
 * The roadmap's four columns as values. `satisfies` ties each one to the public
 * `RoadmapColumn` union, so a typo here is a compile error and the constant can
 * never drift from the type. Compare against these — never a bare "Shipped".
 */
export const ROADMAP_COLUMN = {
  Now: "Now",
  Next: "Next",
  Later: "Later",
  Shipped: "Shipped",
} as const satisfies Record<string, RoadmapColumn>;

// End-user labels for the internal Now/Next/Later/Shipped columns — aligned
// with the feedback statuses users see on cards (Now projects to "In progress",
// Next to "Planned" via the reflect-back), so the widget speaks ONE vocabulary.
const COLUMN_LABELS: Record<RoadmapColumn, string> = {
  Now: "In progress",
  Next: "Planned",
  Later: "Later",
  Shipped: "Shipped",
};

/**
 * The `??` fallbacks here and below are unreachable per the types and stay on
 * purpose: this SDK is versioned independently of the API it calls, so an API
 * that grows a fifth column reaches an OLD bundle first. Falling back beats
 * rendering `undefined` at a visitor.
 */
export function roadmapColumnLabel(column: RoadmapColumn): string {
  return COLUMN_LABELS[column] ?? column;
}

/** Timeline node/dot color per column (amber → blue → gray → green). */
const COLUMN_COLORS: Record<RoadmapColumn, string> = {
  Now: "#FFB946",
  Next: "#3E90F0",
  Later: "#8692A6",
  Shipped: "#2ED47A",
};

const FALLBACK_COLOR = "#8692A6";

export function roadmapColumnColor(column: RoadmapColumn): string {
  return COLUMN_COLORS[column] ?? FALLBACK_COLOR;
}

export function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress));
}
