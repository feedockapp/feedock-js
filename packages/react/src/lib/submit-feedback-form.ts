/**
 * Composer constants + validation for the feedback `SubmitForm`. Kept
 * dependency-free on purpose — the published SDK ships with zero runtime deps —
 * so this is a small pure module the hook and the form both import, instead of
 * thresholds inlined in JSX. The public API re-validates everything; this is
 * UX-only (fast feedback + a disabled Post button).
 */

/** Accepted upload types — mirrors the API allow-list (server re-validates). */
export const ACCEPT_ATTACHMENT_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm";

/** Max attachments per submission (mirrors the API). */
export const MAX_ATTACHMENTS = 10;

/** Max bytes per attachment — 50 MB (mirrors the API). */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/** Minimum lengths (trimmed) for a submittable draft. */
export const MIN_TITLE_LENGTH = 3;
export const MIN_BODY_LENGTH = 1;

/** The editable composer fields. */
export type FeedbackDraft = {
  title: string;
  body: string;
  notifyMe: boolean;
};

/** Field-level validation messages, keyed by field. Empty object = valid. */
export type DraftErrors = {
  title?: string;
  body?: string;
};

/** Validate the draft (trimmed). Returns a message per invalid field. */
export function validateDraft(draft: FeedbackDraft): DraftErrors {
  const errors: DraftErrors = {};

  if (draft.title.trim().length < MIN_TITLE_LENGTH) {
    errors.title = `Give it a title of at least ${MIN_TITLE_LENGTH} characters.`;
  }
  if (draft.body.trim().length < MIN_BODY_LENGTH) {
    errors.body = "Add a short description.";
  }

  return errors;
}

/** Whether the draft passes every field rule. */
export function isDraftSubmittable(draft: FeedbackDraft): boolean {
  return Object.keys(validateDraft(draft)).length === 0;
}

/** The next attachment list after merging a pick, plus an optional skip note. */
export type CollectFilesResult = {
  files: File[];
  /** A user-facing note when some files were skipped (count/size), else null. */
  error: string | null;
};

/**
 * Merge `incoming` files into `current`, enforcing the count + per-file size
 * caps and de-duping by (name, size). Pure — returns the next list + an optional
 * note; the caller owns the state. Mirrors the API limits (server re-validates).
 */
export function collectFiles(
  current: File[],
  incoming: FileList | File[] | null,
): CollectFilesResult {
  if (!incoming) {
    return { files: current, error: null };
  }

  const files = [...current];
  let error: string | null = null;

  for (const file of Array.from(incoming)) {
    if (files.length >= MAX_ATTACHMENTS) {
      error = `You can attach up to ${MAX_ATTACHMENTS} files.`;
      break;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      error = "File is too large (max 50 MB).";
      continue;
    }
    const duplicate = files.some(
      (existing) => existing.name === file.name && existing.size === file.size,
    );
    if (!duplicate) {
      files.push(file);
    }
  }

  return { files, error };
}
