"use client";

import { feedbackBoardListStyles } from "./feedback-board-list-styles";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicFeedbackListItem } from "../../types";
import { FeedbackListItem } from "./feedback-list-item";
import { Spinner, SpinnerBlock } from "../../shared/ui/spinner";

export type Props = {
  items: PublicFeedbackListItem[];
  loading: boolean;
  onVote: (id: string) => void;
  /** Open an item's detail view. */
  onSelect?: (id: string) => void;
};

/**
 * The board's list area: the loading/empty placeholders and the feedback list.
 * Keeps the current list visible (dimmed) while a sort change refetches, so
 * switching Top/New never flashes an empty "Loading…" state.
 */
export function FeedbackBoardList({ items, loading, onVote, onSelect }: Props) {
  const styles = useStyles(feedbackBoardListStyles);

  if (loading && items.length === 0) {
    return <SpinnerBlock />;
  }

  if (items.length === 0) {
    return <div style={styles.empty}>No feedback yet. Be the first to post.</div>;
  }

  return (
    <div style={styles.root}>
      {/* Revalidating with data on screen (e.g. a re-open refresh): keep the
          list visible but dimmed, with a small spinner so the refresh reads. */}
      {loading ? (
        <div style={styles.spinner}>
          <Spinner size={16} />
        </div>
      ) : null}
      <div style={styles.list(loading)}>
        {items.map((item) => (
          <FeedbackListItem
            key={item.id}
            item={item}
            onVote={onVote}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
