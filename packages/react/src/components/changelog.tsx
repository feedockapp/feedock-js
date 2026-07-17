"use client";

import { useEffect, useRef, useState } from "react";

import { useFeedockContext } from "../context";
import { useChangelog } from "../hooks/use-changelog";
import { ChangelogDetail } from "./changelog-detail";
import { ChangelogListItem } from "./changelog-list-item";
import { SpinnerBlock } from "./spinner";

export interface ChangelogProps {
  /** Deep-link: open this entry's detail when `openItemNonce` advances. */
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

/** Embeddable "What's New" — published changelog entries, newest first. */
export function Changelog({
  openItemId = null,
  openItemNonce = 0,
  onDetailOpenChange,
  collapseNonce = 0,
  hideDetailBack,
  reloadKey = 0,
}: ChangelogProps) {
  const { theme } = useFeedockContext();
  const { items: updates, loading, error } = useChangelog(reloadKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Open a deep-linked entry only when the nonce advances (never on mount).
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

  const rootStyle = {
    background: theme.bg,
    color: theme.text,
    fontFamily:
      "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  } as const;

  // Spinner only on a first/empty load; a re-open refresh with entries already
  // on screen keeps them visible while it revalidates (no full-screen flash).
  if (loading && updates.length === 0) {
    return <SpinnerBlock />;
  }
  if (error && updates.length === 0) {
    return <div style={{ fontSize: 13, color: theme.muted }}>{error}</div>;
  }

  const selected = selectedId
    ? updates.find((u) => u.id === selectedId)
    : null;
  if (selected) {
    return (
      <div style={rootStyle}>
        <ChangelogDetail
          update={selected}
          onBack={() => setSelectedId(null)}
          hideBack={hideDetailBack}
        />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div style={{ fontSize: 13, color: theme.muted }}>No updates yet.</div>
    );
  }

  const groupDivider = {
    height: 1,
    flexShrink: 0,
    background:
      theme.mode === "dark" ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.10)",
  } as const;

  return (
    <div style={rootStyle}>
      {updates.flatMap((update, i) => {
        const row = (
          <ChangelogListItem
            key={update.id}
            update={update}
            onSelect={setSelectedId}
          />
        );
        return i === 0
          ? [row]
          : [<div key={`divider-${i}`} style={groupDivider} />, row];
      })}
    </div>
  );
}
