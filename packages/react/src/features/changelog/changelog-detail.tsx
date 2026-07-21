"use client";

import { type CSSProperties, useCallback, useState } from "react";

import { useFeedockContext, type VisitorIdentity } from "../../context";
import { formatDate } from "../../shared/lib/format";
import { useStyles } from "../../shared/lib/use-styles";
import { Avatar } from "../../shared/ui/avatar";
import { DetailBack } from "../../shared/ui/detail-back";
import { SafeHtml } from "../../shared/ui/safe-html";
import type { PublicUpdate } from "../../types";
import { CommentRow } from "../feedback/feedback-comment-row";
import { escapeHtml } from "../feedback/feedback-detail-escape";
import { IdentityPrompt } from "../submit/identity-prompt";
import { changelogDetailStyles } from "./changelog-detail-styles";
import { useUpdateDetail } from "./use-update-detail";

export type Props = {
  update: PublicUpdate;
  onBack: () => void;
  /** Hide the in-body back affordance when the host renders its own (widget). */
  hideBack?: boolean;
};

/** Fully static (no theme/hover deps) — hoisted so they aren't rebuilt each render. */
const AUTHOR_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

/** Cover (hero) — after the header, before the body. */
const COVER_STYLE: CSSProperties = {
  width: "100%",
  maxHeight: 240,
  objectFit: "cover",
  borderRadius: 10,
  display: "block",
  margin: "14px 0 0",
};

/**
 * A single published update, as an article: a category eyebrow leads, then the
 * title, a why-it-matters line, a byline (author · date), the cover image, the
 * full body, and an account-less comment thread. The header renders from the
 * list item; comments are fetched on open ({@link useUpdateDetail}) and a reply
 * is identity-gated (magic-link), mirroring the feedback detail.
 */
export function ChangelogDetail({ update, onBack, hideBack }: Props) {
  const styles = useStyles(changelogDetailStyles);
  const { client, identity, ensureIdentity } = useFeedockContext();
  const { detail, loading, prependComment } = useUpdateDetail(update.slug);

  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  // A pending write held while a true-anonymous visitor verifies their email.
  const [gate, setGate] = useState<{
    run: (identity: VisitorIdentity) => void;
  } | null>(null);

  // Verify the visitor first if needed; a signed-in host user is recognized
  // silently (auto-identify) before the email prompt shows.
  const guarded = useCallback(
    (run: (identity: VisitorIdentity) => void) => {
      if (identity) {
        run(identity);
        return;
      }
      void ensureIdentity().then((resolved) => {
        if (resolved) {
          run(resolved);
        } else {
          setGate({ run });
        }
      });
    },
    [identity, ensureIdentity],
  );

  function submitComment() {
    const body = comment.trim();
    // `posting` guards the ⌘/Ctrl+Enter path (the button is disabled, but the
    // shortcut bypasses it — without this a fast double-press posts twice).
    if (!body || posting) {
      return;
    }
    // Named runner (not an inline arrow) so it reads as an event handler, not a
    // state updater — it's called once by `guarded` after identity resolves.
    const post = (id: VisitorIdentity) => {
      setPosting(true);
      setCommentError(null);
      client
        .commentOnUpdate(id.token, update.slug, body)
        .then(() => {
          prependComment({
            id: `local-${detail?.comments.length ?? 0}-${body.length}`,
            body: escapeHtml(body),
            authorName: "You",
            // The visitor's own avatar isn't known client-side (identity carries
            // email + token only) → a letter-avatar; a refetch replaces it.
            authorAvatarUrl: null,
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
    };
    guarded(post);
  }

  const count = detail?.commentCount ?? update.commentCount;

  return (
    <div>
      {hideBack ? null : <DetailBack onBack={onBack} />}

      <div style={styles.eyebrow}>{update.category}</div>

      <h3 style={styles.title}>{update.title}</h3>
      {update.whyItMatters ? (
        <p style={styles.whyItMatters}>{update.whyItMatters}</p>
      ) : null}

      <div style={styles.byline}>
        {update.author ? (
          <span style={AUTHOR_STYLE}>
            <Avatar
              name={update.author.name}
              imageUrl={update.author.avatarUrl}
              size={20}
            />
            <span style={styles.authorName}>{update.author.name}</span>
          </span>
        ) : null}
        <span>
          {update.author ? "· " : ""}
          {formatDate(update.publishedAt)}
        </span>
      </div>

      {update.coverImageUrl ? (
        <img src={update.coverImageUrl} alt="" style={COVER_STYLE} />
      ) : null}

      <SafeHtml html={update.body} style={styles.body} />

      <div style={styles.divider} />

      <p style={styles.commentsHead}>
        Comments
        <span style={styles.commentsCount}>· {count}</span>
      </p>

      {gate ? (
        <IdentityPrompt
          action="comment"
          onVerified={(id) => {
            const run = gate.run;
            setGate(null);
            run(id);
          }}
          onCancel={() => setGate(null)}
        />
      ) : (
        <div style={styles.composer}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitComment();
              }
            }}
            placeholder="Add a comment…"
            aria-label="Add a comment"
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
      )}

      {loading && !detail ? (
        <div style={styles.muted}>Loading comments…</div>
      ) : (
        (detail?.comments ?? []).map((c) => (
          <CommentRow key={c.id} comment={c} />
        ))
      )}
    </div>
  );
}
