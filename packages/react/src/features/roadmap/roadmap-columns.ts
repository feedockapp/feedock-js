// End-user labels for the internal Now/Next/Later/Shipped columns — aligned
// with the feedback statuses users see on cards (Now projects to "In progress",
// Next to "Planned" via the reflect-back), so the widget speaks ONE vocabulary.
const COLUMN_LABELS: Record<string, string> = {
  Now: "In progress",
  Next: "Planned",
  Later: "Later",
  Shipped: "Shipped",
};

export function roadmapColumnLabel(column: string): string {
  return COLUMN_LABELS[column] ?? column;
}

/** Timeline node/dot color per column (amber → blue → gray → green). */
const COLUMN_COLORS: Record<string, string> = {
  Now: "#FFB946",
  Next: "#3E90F0",
  Later: "#8692A6",
  Shipped: "#2ED47A",
};

export function roadmapColumnColor(column: string): string {
  return COLUMN_COLORS[column] ?? "#8692A6";
}

export function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress));
}
