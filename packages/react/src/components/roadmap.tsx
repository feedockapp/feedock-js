"use client";

import { useEffect, useRef, useState } from "react";

import { useFeedockContext } from "../context";
import { useRoadmap } from "../hooks/use-roadmap";
import { roadmapStyles } from "../lib/roadmap-styles";
import { RoadmapColumn } from "./roadmap-column";
import { RoadmapDetail } from "./roadmap-detail";
import { SpinnerBlock } from "./spinner";

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
  const { theme } = useFeedockContext();
  const { columns, loading, error } = useRoadmap(reloadKey);
  const styles = roadmapStyles(theme);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Open a deep-linked item only when the nonce advances (never on mount).
  const lastOpenNonce = useRef(openItemNonce);
  useEffect(() => {
    if (openItemNonce !== lastOpenNonce.current) {
      lastOpenNonce.current = openItemNonce;
      if (openItemId) {
        setSelectedId(openItemId);
      }
    }
  }, [openItemNonce, openItemId]);
  // Report detail open/close transitions to the host (once per change).
  const detailWasOpen = useRef(false);
  useEffect(() => {
    const isOpen = selectedId !== null;
    if (isOpen !== detailWasOpen.current) {
      detailWasOpen.current = isOpen;
      onDetailOpenChange?.(isOpen);
    }
  }, [selectedId, onDetailOpenChange]);
  // Host bumped collapseNonce (e.g. a tab switch) — close any open detail.
  const lastCollapse = useRef(collapseNonce);
  useEffect(() => {
    if (collapseNonce !== lastCollapse.current) {
      lastCollapse.current = collapseNonce;
      setSelectedId(null);
    }
  }, [collapseNonce]);

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
        <RoadmapDetail
          item={selected}
          onBack={() => setSelectedId(null)}
          hideBack={hideDetailBack}
        />
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
        <RoadmapColumn
          key={group.column}
          group={group}
          styles={styles}
          onSelect={setSelectedId}
        />
      ))}
    </div>
  );
}
