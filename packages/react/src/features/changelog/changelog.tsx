"use client";

import { useDetailSelection } from "../../shared/hooks/use-detail-selection";
import { useStyles } from "../../shared/lib/use-styles";
import { LoadMore } from "../../shared/ui/load-more";
import { SpinnerBlock } from "../../shared/ui/spinner";
import { ChangelogDetail } from "./changelog-detail";
import { ChangelogListItem } from "./changelog-list-item";
import { changelogStyles } from "./changelog-styles";
import { useChangelog } from "./use-changelog";

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
  const styles = useStyles(changelogStyles);
  const {
    items: updates,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
  } = useChangelog(reloadKey);
  // The host protocol — deep-link open, collapse, and the open/close notify the
  // widget's Back button depends on. See shared/hooks/use-detail-selection.
  const { selectedId, select, close } = useDetailSelection({
    openItemId,
    openItemNonce,
    collapseNonce,
    onDetailOpenChange,
  });

  // Spinner only on a first/empty load; a re-open refresh with entries already
  // on screen keeps them visible while it revalidates (no full-screen flash).
  if (loading && updates.length === 0) {
    return <SpinnerBlock />;
  }

  if (error && updates.length === 0) {
    return <div style={styles.message}>{error}</div>;
  }

  const selected = selectedId ? updates.find((u) => u.id === selectedId) : null;
  if (selected) {
    return (
      <div style={styles.root}>
        <ChangelogDetail
          key={selected.id}
          update={selected}
          onBack={close}
          hideBack={hideDetailBack}
        />
      </div>
    );
  }

  if (updates.length === 0) {
    return <div style={styles.message}>No updates yet.</div>;
  }

  return (
    <div style={styles.root}>
      {updates.flatMap((update, i) => {
        const row = (
          <ChangelogListItem
            key={update.id}
            update={update}
            onSelect={select}
          />
        );
        return i === 0
          ? [row]
          : [<div key={`divider-${i}`} style={styles.groupDivider} />, row];
      })}
      {hasMore ? <LoadMore onClick={loadMore} loading={loadingMore} /> : null}
    </div>
  );
}
