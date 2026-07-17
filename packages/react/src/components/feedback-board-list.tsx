"use client";

import { useFeedockContext } from "../context";
import type { PublicFeedbackListItem } from "../types";
import { FeedbackListItem } from "./feedback-list-item";
import { Spinner, SpinnerBlock } from "./spinner";

type Props = {
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
  const { theme } = useFeedockContext();

  if (loading && items.length === 0) {
    return <SpinnerBlock />;
  }

  if (items.length === 0) {
    return (
      <div style={{ fontSize: 13, color: theme.muted, padding: "16px 0" }}>
        No feedback yet. Be the first to post.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Revalidating with data on screen (e.g. a re-open refresh): keep the
          list visible but dimmed, with a small spinner so the refresh reads. */}
      {loading ? (
        <div style={{ position: "absolute", top: 0, right: 0, zIndex: 1 }}>
          <Spinner size={16} />
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          opacity: loading ? 0.55 : 1,
          transition: "opacity 0.15s ease",
        }}
      >
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
