"use client";

import { useState } from "react";

import { useFeedockContext, type VisitorIdentity } from "../../context";
import { useFeedbackDetail } from "./use-feedback-detail";
import { feedbackDetailStyles } from "./feedback-detail-styles";
import { formatShortDate } from "../home/home-format";
import { statusTone } from "../../theme";
import type { PublicComment } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { StatusIcon } from "./feedback-card-icons";
import { SafeHtml } from "../../shared/ui/safe-html";
import { SpinnerBlock } from "../../shared/ui/spinner";

/** A small up-caret for the vote pill. */
function VoteCaret() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 15l7-7 7 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  id: string;
  onBack: () => void;
  /** Identity-gated write runner (shared with the board). */
  guarded: (action: string, run: (identity: VisitorIdentity) => void) => void;
  /** Fan a detail vote back into the list so its count isn't stale on back. */
  onVoteCount?: (id: string, voteCount: number) => void;
  /** Hide the in-body back affordance when the host renders its own (widget). */
  hideBack?: boolean;
};

/** Escape a plain-text comment for the optimistic (pre-refetch) render. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** One comment row: author (+ official badge) · time, then the body. */
function CommentRow({
  comment,
  styles,
}: {
  comment: PublicComment;
  styles: ReturnType<typeof feedbackDetailStyles>;
}) {
  return (
    <div style={styles.comment}>
      <div style={styles.commentMeta}>
        <span style={styles.commentAuthor}>{comment.authorName}</span>
        {comment.isOfficial ? (
          <span style={styles.officialBadge}>TEAM</span>
        ) : null}
        <span style={styles.commentTime}>
          {formatShortDate(comment.createdAt)}
        </span>
      </div>
      <SafeHtml html={comment.body} style={styles.commentBody} />
    </div>
  );
}

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
  const { theme, client } = useFeedockContext();
  const { detail, loading, error, setVoteCount, prependComment } =
    useFeedbackDetail(id);
  const styles = feedbackDetailStyles(theme);
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
                <span style={styles.bylineDate}>
                  {formatShortDate(detail.createdAt)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ ...styles.bylineDate, marginBottom: 16 }}>
              {formatShortDate(detail.createdAt)}
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
                <VoteCaret />
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
              <p style={{ fontSize: 12.5, color: "#D33A3F", margin: 0 }} role="alert">
                {commentError}
              </p>
            ) : null}
          </div>

          {detail.comments.map((c) => (
            <CommentRow key={c.id} comment={c} styles={styles} />
          ))}
        </>
      )}
    </div>
  );
}
