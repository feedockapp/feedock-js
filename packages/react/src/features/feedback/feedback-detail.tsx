"use client";

import { useState } from "react";

import { useFeedockContext, type VisitorIdentity } from "../../context";
import { DATE_STYLE, formatDate } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import { Avatar } from "../../shared/ui/avatar";
import { SafeHtml } from "../../shared/ui/safe-html";
import { SpinnerBlock } from "../../shared/ui/spinner";
import { statusTone } from "../../theme";
import { StatusIcon, VoteCaretIcon } from "./feedback-card-icons";
import { CommentRow } from "./feedback-comment-row";
import { escapeHtml } from "./feedback-detail-escape";
import { feedbackDetailStyles } from "./feedback-detail-styles";
import { useFeedbackDetail } from "./use-feedback-detail";

export type Props = {
  id: string;
  onBack: () => void;
  /** Identity-gated write runner (shared with the board). */
  guarded: (action: string, run: (identity: VisitorIdentity) => void) => void;
  /** Fan a detail vote back into the list so its count isn't stale on back. */
  onVoteCount?: (id: string, voteCount: number) => void;
  /** Same for a posted comment — otherwise the card still reads the old count. */
  onCommentCount?: (id: string, commentCount: number) => void;
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
  onCommentCount,
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
    // `posting` matters for the keyboard path: the button is disabled while a
    // comment is in flight, but ⌘/Ctrl+Enter doesn't go through the button, so
    // without this a fast double-press would post twice.
    if (!body || !detail || posting) {
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
            // The visitor's own avatar isn't known client-side (identity carries
            // email + token only), so the optimistic row draws a letter-avatar;
            // a refetch replaces it with the real one.
            authorAvatarUrl: null,
            isOfficial: false,
            createdAt: new Date().toISOString(),
          });
          setComment("");
          // Keep the list card in step — it holds its own copy of the count and
          // never refetches on back, so without this it still shows the old one.
          onCommentCount?.(detail.id, detail.commentCount + 1);
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
              onKeyDown={(e) => {
                // ⌘/Ctrl+Enter sends. A bare Enter still makes a newline — the
                // box is multi-line, so it can't be the send key.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitComment();
                }
              }}
              placeholder="Add a comment…"
              style={styles.textarea}
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={posting || comment.trim().length === 0}
              title="Comment (⌘↵ / Ctrl+↵)"
              aria-keyshortcuts="Meta+Enter Control+Enter"
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
