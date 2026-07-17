"use client";

import { useState } from "react";

import { useFeedockContext, type VisitorIdentity } from "../../context";
import { useFeedbackDetail } from "./use-feedback-detail";
import { escapeHtml } from "./feedback-detail-escape";
import { feedbackDetailStyles } from "./feedback-detail-styles";
import { CommentRow } from "./feedback-comment-row";
import { DATE_STYLE, formatDate } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import { statusTone } from "../../theme";
import { Avatar } from "../../shared/ui/avatar";
import { StatusIcon, VoteCaretIcon } from "./feedback-card-icons";
import { SafeHtml } from "../../shared/ui/safe-html";
import { SpinnerBlock } from "../../shared/ui/spinner";

export type Props = {
  id: string;
  onBack: () => void;
  /** Identity-gated write runner (shared with the board). */
  guarded: (action: string, run: (identity: VisitorIdentity) => void) => void;
  /** Fan a detail vote back into the list so its count isn't stale on back. */
  onVoteCount?: (id: string, voteCount: number) => void;
  /** Hide the in-body back affordance when the host renders its own (widget). */
  hideBack?: boolean;
};

/**
 * A single feedback item: back to the list, vote, the full body, its comments,
 * and an identity-gated comment composer. Fetches its own detail; vote/comment
 * writes reuse the board's identity gate.
 */
export function FeedbackDetail({
  id,
  onBack,
  guarded,
  onVoteCount,
  hideBack,
}: Props) {
  const { client } = useFeedockContext();
  const { detail, loading, error, setVoteCount, prependComment } =
    useFeedbackDetail(id);
  const styles = useStyles(feedbackDetailStyles);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  function vote() {
    if (!detail) {
      return;
    }
    guarded("vote", (identity) => {
      client
        .vote(identity.token, detail.id)
        .then((r) => {
          setVoteCount(r.voteCount);
          onVoteCount?.(detail.id, r.voteCount);
        })
        .catch(() => undefined);
    });
  }

  function submitComment() {
    const body = comment.trim();
    if (!body || !detail) {
      return;
    }
    guarded("comment", (identity) => {
      setPosting(true);
      setCommentError(null);
      client
        .comment(identity.token, detail.id, body)
        .then(() => {
          prependComment({
            id: `local-${detail.comments.length}-${body.length}`,
            body: escapeHtml(body),
            authorName: "You",
            isOfficial: false,
            createdAt: new Date().toISOString(),
          });
          setComment("");
        })
        .catch((e: unknown) =>
          setCommentError(
            e instanceof Error ? e.message : "Couldn't post your comment.",
          ),
        )
        .finally(() => setPosting(false));
    });
  }

  return (
    <div>
      {hideBack ? null : (
        <button type="button" onClick={onBack} style={styles.back}>
          <span aria-hidden>←</span> Back
        </button>
      )}

      {loading ? (
        <SpinnerBlock />
      ) : error || !detail ? (
        <div style={styles.muted}>{error ?? "Not found."}</div>
      ) : (
        <>
          {/* Byline: submitter + date, leading the item. */}
          {detail.author ? (
            <div style={styles.byline}>
              <Avatar
                name={detail.author.name}
                imageUrl={detail.author.avatarUrl}
                size={40}
              />
              <div style={styles.bylineText}>
                <span style={styles.bylineName}>{detail.author.name}</span>
                <span style={styles.bylineDate()}>
                  {formatDate(detail.createdAt, DATE_STYLE.Short)}
                </span>
              </div>
            </div>
          ) : (
            <div style={styles.bylineDate(true)}>
              {formatDate(detail.createdAt, DATE_STYLE.Short)}
            </div>
          )}

          <h3 style={styles.title}>{detail.title}</h3>
          <SafeHtml html={detail.body} style={styles.body} />

          {/* Footer: status (left) · vote pill (right, upvotes). */}
          <div style={styles.footer}>
            <span style={styles.statusPill}>
              <span style={styles.statusIcon(statusTone(detail.status).fg)}>
                <StatusIcon status={detail.status} />
              </span>
              {statusTone(detail.status).label}
            </span>
            <button
              type="button"
              onClick={vote}
              aria-label="Upvote"
              style={styles.votePill(false)}
            >
              <span style={styles.voteCaret}>
                <VoteCaretIcon />
              </span>
              <span style={styles.voteNum}>{detail.voteCount}</span>
            </button>
          </div>

          <div style={styles.divider} />

          <p style={styles.commentsHead}>
            Comments
            <span style={styles.commentsCount}>· {detail.commentCount}</span>
          </p>

          <div style={styles.composer}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              style={styles.textarea}
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={posting || comment.trim().length === 0}
              style={styles.postButton(posting || comment.trim().length === 0)}
            >
              {posting ? "Posting…" : "Comment"}
            </button>
            {commentError ? (
              <p style={styles.commentError} role="alert">
                {commentError}
              </p>
            ) : null}
          </div>

          {detail.comments.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </>
      )}
    </div>
  );
}
