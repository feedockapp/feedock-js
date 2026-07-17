"use client";

import { useEffect, useState } from "react";

import { useFeedockContext } from "../context";
import { useFeedock } from "../use-feedock";
import { useSimilarFeedback } from "../hooks/use-similar-feedback";
import {
  useSubmitFeedback,
  type UseSubmitFeedback,
} from "../hooks/use-submit-feedback";
import { composerStyles } from "../lib/composer-styles";
import {
  ACCEPT_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
} from "../lib/submit-feedback-form";
import type { PublicFeedbackListItem } from "../types";
import { AttachmentList } from "./attachment-list";
import { IdentityPrompt } from "./identity-prompt";
import { SimilarSuggestions } from "./similar-suggestions";

type Props = {
  /** Called with the new item after a successful post. */
  onPosted: (item: PublicFeedbackListItem) => void;
};

/** A small image icon for the attach button. */
function ImageIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" />
      <circle cx="8.5" cy="9.5" r="1.6" fill={color} />
      <path d="M5 18l4.5-4.5 3 3L16 12l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The seamless title + body form, attachments, and a bottom toolbar. */
function ComposerForm({
  form,
  onPost,
}: {
  form: UseSubmitFeedback;
  /** Post the draft — gates on verification first (handled by the parent). */
  onPost: () => void;
}) {
  const { theme } = useFeedockContext();
  const {
    title,
    setTitle,
    body,
    setBody,
    notifyMe,
    setNotifyMe,
    files,
    addFiles,
    removeFile,
    fileInput,
    canSubmit,
    busy,
    error,
  } = form;
  const similar = useSimilarFeedback(title, body);
  const styles = composerStyles(theme);

  return (
    <div style={styles.root}>
      <div style={styles.scroll}>
        <input
          aria-label="Title"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={styles.title}
        />
        <textarea
          aria-label="Description"
          placeholder="What's on your mind?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={styles.body}
        />
        <SimilarSuggestions matches={similar} />
        <AttachmentList files={files} onRemove={removeFile} />
        <label style={styles.notifyRow}>
          <button
            type="button"
            role="checkbox"
            aria-checked={notifyMe}
            aria-label="Email me when this ships"
            onClick={() => setNotifyMe(!notifyMe)}
            style={{
              width: 16,
              height: 16,
              flexShrink: 0,
              padding: 0,
              borderRadius: "50%",
              cursor: "pointer",
              border: `1px solid ${notifyMe ? theme.brand : theme.border}`,
              background: notifyMe ? theme.brand : "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {notifyMe ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.onBrand} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
          </button>
          Email me when this ships
        </label>
        {error ? <div style={styles.error}>{error}</div> : null}
      </div>

      <div style={styles.toolbar}>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTACHMENT_TYPES}
          multiple
          onChange={(e) => addFiles(e.target.files)}
          style={{ display: "none" }}
          tabIndex={-1}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy || files.length >= MAX_ATTACHMENTS}
          aria-label="Attach image or video"
          style={styles.iconButton}
        >
          <ImageIcon color={theme.muted} />
        </button>
        <button
          type="button"
          onClick={onPost}
          disabled={busy || !canSubmit}
          style={styles.post(busy || !canSubmit)}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

/**
 * Full-panel "Give feedback" composer. Compose-first: the visitor writes their
 * title + body straight away, and only confirms their email (the one-time
 * magic-link) when they hit Post — the draft is held here so it survives the
 * gate, and the post fires automatically once verification completes. An
 * already-verified visitor (or a host-SSO session) skips the gate entirely.
 * Drop it into a panel that fills its height.
 */
export function Composer({ onPosted }: Props) {
  const { theme } = useFeedockContext();
  const { isVerified, ensureIdentity } = useFeedock();
  const form = useSubmitFeedback({ onSubmitted: onPosted });
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Post the held draft as soon as the visitor becomes verified (auto-submit
  // after the magic-link). Guarded by `pendingSubmit` so a visitor who was
  // already verified on mount isn't submitted without clicking Post.
  useEffect(() => {
    if (pendingSubmit && isVerified) {
      setPendingSubmit(false);
      void form.onSubmit();
    }
  }, [pendingSubmit, isVerified, form]);

  async function handlePost() {
    if (isVerified) {
      void form.onSubmit();
      return;
    }
    // A signed-in host user may still be mid-auto-identify (SSO) — recognize
    // them silently before ever showing the email prompt. `pendingSubmit` then
    // fires the post once the resolved session flips `isVerified` true.
    const resolved = await ensureIdentity();
    if (resolved) {
      setPendingSubmit(true);
      return;
    }
    setGateOpen(true);
  }

  if (gateOpen && !isVerified) {
    return (
      <div style={composerStyles(theme).gateWrap}>
        <IdentityPrompt
          action="post"
          onVerified={() => {
            setGateOpen(false);
            setPendingSubmit(true);
          }}
          onCancel={() => setGateOpen(false)}
        />
      </div>
    );
  }

  return <ComposerForm form={form} onPost={handlePost} />;
}
