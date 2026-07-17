"use client";

import { useState } from "react";

import { useFeedockContext } from "../../context";
import { feedbackListItemStyles } from "./feedback-list-item-styles";
import { statusTone } from "../../theme";
import type { PublicFeedbackListItem } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { CommentIcon, StatusIcon, VoteArrowIcon } from "./feedback-card-icons";
import { SafeHtml } from "../../shared/ui/safe-html";

type Props = {
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
export function FeedbackListItem({ item, onVote, onSelect }: Props) {
  const { theme } = useFeedockContext();
  const tone = statusTone(item.status);
  const [hover, setHover] = useState(false);
  const styles = feedbackListItemStyles(theme, tone, hover);

  return (
    <div
      style={styles.root}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={() => onSelect?.(item.id)}
        style={{ ...styles.content, cursor: onSelect ? "pointer" : "default" }}
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
            <span style={styles.statusMetaIcon}>
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
