"use client";

import { useFeedockContext } from "../../context";
import { useSimilarFeedback } from "./use-similar-feedback";
import { useSubmitFeedback } from "./use-submit-feedback";
import {
  ACCEPT_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
} from "./submit-feedback-form";
import { submitFormStyles } from "./submit-form-styles";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicFeedbackListItem } from "../../types";
import { AttachmentList } from "./attachment-list";
import { SimilarSuggestions } from "./similar-suggestions";

export type Props = {
  onSubmitted: (item: PublicFeedbackListItem) => void;
  onCancel: () => void;
};

/** Compose + submit a new public feedback item (visitor already verified). */
export function SubmitForm({ onSubmitted, onCancel }: Props) {
  // `theme` for the inline checkmark's stroke; `styles` from the shared memo.
  const { theme } = useFeedockContext();
  const styles = useStyles(submitFormStyles);
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
    errors,
    canSubmit,
    busy,
    error,
    shown,
    onSubmit,
  } = useSubmitFeedback({ onSubmitted });
  const similar = useSimilarFeedback(title, body);

  return (
    <div style={styles.root(shown)}>
      <input
        aria-label="Title"
        placeholder="Short, clear title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={styles.field}
      />
      {/* Only nag once they've started typing — a pristine field stays quiet. */}
      {title.trim() && errors.title ? (
        <div style={styles.error}>{errors.title}</div>
      ) : null}

      <textarea
        aria-label="Description"
        placeholder="Describe your idea or problem…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        style={styles.textarea}
      />

      <SimilarSuggestions matches={similar} />

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTACHMENT_TYPES}
        multiple
        onChange={(e) => addFiles(e.target.files)}
        style={styles.hiddenFileInput}
        tabIndex={-1}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy || files.length >= MAX_ATTACHMENTS}
        style={styles.attachButton}
      >
        📎 Attach image or video
      </button>
      <AttachmentList files={files} onRemove={removeFile} />

      <label style={styles.notifyRow}>
        <button
          type="button"
          role="checkbox"
          aria-checked={notifyMe}
          aria-label="Email me when this ships"
          onClick={() => setNotifyMe(!notifyMe)}
          style={styles.notifyCheckbox(notifyMe)}
        >
          {notifyMe ? (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.onBrand}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : null}
        </button>
        Email me when this ships
      </label>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !canSubmit}
          style={styles.postButton(busy)}
        >
          {busy ? "Posting…" : "Post"}
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancel
        </button>
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}
    </div>
  );
}
