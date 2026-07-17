"use client";

import { useRoadmap } from "./use-roadmap";
import { roadmapStyles } from "./roadmap-styles";
import { useDetailSelection } from "../../shared/hooks/use-detail-selection";
import { useStyles } from "../../shared/lib/use-styles";
import { RoadmapColumn } from "./roadmap-column";
import { RoadmapDetail } from "./roadmap-detail";
import { SpinnerBlock } from "../../shared/ui/spinner";

export interface RoadmapProps {
  /** Deep-link: open this item's detail when `openItemNonce` advances. */
  openItemId?: string | null;
  openItemNonce?: number;
  /** Fired when the detail view opens/closes — the host can resize + restore origin. */
  onDetailOpenChange?: (open: boolean) => void;
  /** Advance to force-close any open detail (e.g. the host switched tabs). */
  collapseNonce?: number;
  /** Hide the detail's in-body back (the host renders its own — e.g. the widget). */
  hideDetailBack?: boolean;
  /** Bumped when the host re-opens the widget — refetch (fresh data). */
  reloadKey?: number;
}

/** Embeddable public roadmap (Now / Next / Later / Shipped). */
export function Roadmap({
  openItemId = null,
  openItemNonce = 0,
  onDetailOpenChange,
  collapseNonce = 0,
  hideDetailBack,
  reloadKey = 0,
}: RoadmapProps) {
  const styles = useStyles(roadmapStyles);
  const { columns, loading, error } = useRoadmap(reloadKey);
  // The host protocol — deep-link open, collapse, and the open/close notify the
  // widget's Back button depends on. See shared/hooks/use-detail-selection.
  const { selectedId, select, close } = useDetailSelection({
    openItemId,
    openItemNonce,
    collapseNonce,
    onDetailOpenChange,
  });

  // Spinner only on a first/empty load; a re-open refresh with columns already
  // on screen keeps them visible while it revalidates (no full-screen flash).
  if (loading && columns.length === 0) {
    return <SpinnerBlock />;
  }

  if (error && columns.length === 0) {
    return <div style={styles.message}>{error}</div>;
  }

  const selected = selectedId
    ? columns.flatMap((g) => g.items).find((i) => i.id === selectedId)
    : null;
  if (selected) {
    return (
      <div style={styles.root}>
        <RoadmapDetail item={selected} onBack={close} hideBack={hideDetailBack} />
      </div>
    );
  }

  // Only show sections that have items (an empty status reads as noise).
  const visible = columns.filter((group) => group.items.length > 0);
  if (visible.length === 0) {
    return <div style={styles.message}>Nothing on the roadmap yet.</div>;
  }

  return (
    <div style={styles.root}>
      {visible.map((group) => (
        <RoadmapColumn key={group.column} group={group} onSelect={select} />
      ))}
    </div>
  );
}
