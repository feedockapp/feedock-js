"use client";

import { memo } from "react";

import { DATE_STYLE, formatDate } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import { Avatar } from "../../shared/ui/avatar";
import { SafeHtml } from "../../shared/ui/safe-html";
import type { PublicComment } from "../../types";
import { feedbackCommentRowStyles } from "./feedback-comment-row-styles";

export type Props = {
  comment: PublicComment;
};

/** One comment row: author (+ official badge) · time, then the body. */
function CommentRowImpl({ comment }: Props) {
  const styles = useStyles(feedbackCommentRowStyles);

  return (
    <div style={styles.root}>
      <div style={styles.meta}>
        <Avatar
          name={comment.authorName}
          imageUrl={comment.authorAvatarUrl}
          size={20}
        />
        <span style={styles.author}>{comment.authorName}</span>
        {comment.isOfficial ? (
          <span style={styles.officialBadge}>TEAM</span>
        ) : null}
        <span style={styles.time}>
          {formatDate(comment.createdAt, DATE_STYLE.Short)}
        </span>
      </div>
      <SafeHtml html={comment.body} style={styles.body} />
    </div>
  );
}

/**
 * Memoized: `comment` is the only prop now that the row owns its styles, and the
 * detail's comment objects keep their identity (a new one is only prepended on
 * post). The win is the detail's composer — typing a comment re-renders the
 * detail on every keystroke and no longer touches the rows below it.
 */
export const CommentRow = memo(CommentRowImpl);
