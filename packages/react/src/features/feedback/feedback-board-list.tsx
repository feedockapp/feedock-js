"use client";

import { useStyles } from "../../shared/lib/use-styles";
import { LoadMore } from "../../shared/ui/load-more";
import { Spinner, SpinnerBlock } from "../../shared/ui/spinner";
import type { PublicFeedbackListItem } from "../../types";
import { feedbackBoardListStyles } from "./feedback-board-list-styles";
import { FeedbackListItem } from "./feedback-list-item";

export type Props = {
  items: PublicFeedbackListItem[];
  loading: boolean;
  onVote: (id: string) => void;
  /** Open an item's detail view. */
  onSelect?: (id: string) => void;
  /** A search is active — an empty list means "no matches", not "no feedback". */
  searching?: boolean;
  /** More pages exist — render the "Load more" control. */
  hasMore?: boolean;
  /** A next page is in flight. */
  loadingMore?: boolean;
  /** Fetch the next page. */
  onLoadMore?: () => void;
};

/**
 * The board's list area: the loading/empty placeholders and the feedback list.
 * Keeps the current list visible (dimmed) while a sort change refetches, so
 * switching Top/New never flashes an empty "Loading…" state.
 */
export function FeedbackBoardList({
  items,
  loading,
  onVote,
  onSelect,
  searching,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  const styles = useStyles(feedbackBoardListStyles);

  if (loading && items.length === 0) {
    return <SpinnerBlock />;
  }

  if (items.length === 0) {
    // A search that matched nothing isn't an empty board — don't tell someone
    // who just searched to "be the first to post".
    return (
      <div style={styles.empty}>
        {searching
          ? "No matching feedback."
          : "No feedback yet. Be the first to post."}
      </div>
    );
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
      {hasMore && onLoadMore ? (
        <LoadMore onClick={onLoadMore} loading={loadingMore ?? false} />
      ) : null}
    </div>
  );
}
