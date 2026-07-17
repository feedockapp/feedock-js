"use client";

import { memo, useState } from "react";

import { feedbackListItemStyles } from "./feedback-list-item-styles";
import { useStyles } from "../../shared/lib/use-styles";
import { statusTone } from "../../theme";
import type { PublicFeedbackListItem } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { CommentIcon, StatusIcon, VoteArrowIcon } from "./feedback-card-icons";
import { SafeHtml } from "../../shared/ui/safe-html";

export type Props = {
  item: PublicFeedbackListItem;
  onVote: (id: string) => void;
  /** Open the item's detail view (clicking the card body). */
  onSelect?: (id: string) => void;
};

/**
 * One feedback card (portal FeedbackCard style): a status badge over the title +
 * excerpt + meta, with a full-height upvote column on the right split off by a
 * hairline.
 */
function FeedbackListItemImpl({ item, onVote, onSelect }: Props) {
  const styles = useStyles(feedbackListItemStyles);
  const tone = statusTone(item.status);
  const [hover, setHover] = useState(false);

  return (
    <div
      style={styles.root(hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={() => onSelect?.(item.id)}
        style={styles.content(Boolean(onSelect))}
      >
        <div style={styles.title}>{item.title}</div>
        <SafeHtml html={item.body} style={styles.body} />
        <div style={styles.meta}>
          <span style={styles.metaItem}>
            <CommentIcon />
            {item.commentCount}
          </span>
          <span style={styles.statusMeta}>
            <span style={styles.metaDivider} aria-hidden />
            <span style={styles.statusMetaIcon(tone.fg)}>
              <StatusIcon status={item.status} />
            </span>
            {tone.label}
          </span>
          {item.board ? (
            <span style={styles.metaShrink}>
              <span style={styles.metaDivider} aria-hidden />
              <span style={styles.boardName}>{item.board.name}</span>
            </span>
          ) : null}
          {item.author ? (
            // No leading divider — the avatar is the separator.
            <span style={styles.metaShrink}>
              <Avatar
                name={item.author.name}
                imageUrl={item.author.avatarUrl}
                size={16}
              />
              <span style={styles.authorName}>{item.author.name}</span>
            </span>
          ) : null}
        </div>
      </button>

      <button
        type="button"
        onClick={() => onVote(item.id)}
        aria-label="Upvote"
        style={styles.voteColumn}
      >
        <span style={styles.voteArrow}>
          <VoteArrowIcon />
        </span>
        <span style={styles.voteCount}>{item.voteCount}</span>
      </button>
    </div>
  );
}

/**
 * Memoized, and this is the one that earns its keep. The board re-renders on
 * every SEARCH KEYSTROKE (and on each sort-pill hover); without this, all N
 * cards re-rendered and each rebuilt its own style map on every character.
 *
 * Props are stable now: `item` comes off the list reducer, which reuses the
 * object for every row a vote didn't touch; `onVote` is useCallback'd in
 * use-feedback-board; `onSelect` is `select` from useDetailSelection. Hover is
 * local state.
 */
export const FeedbackListItem = memo(FeedbackListItemImpl);
