"use client";

import { formatSize } from "../../shared/lib/format";
import { attachmentPillStyles } from "./attachment-pill-styles";
import { useStyles } from "../../shared/lib/use-styles";
import { useImagePreview } from "./use-image-preview";

export type Props = { file: File; onRemove: () => void };

/** One picked-but-not-yet-uploaded file in the SDK composer. */
export function AttachmentPill({ file, onRemove }: Props) {
  // `useImagePreview` owns the object-URL lifecycle (create + revoke) — see the
  // hook; it is genuinely load-bearing, not a removable effect.
  const preview = useImagePreview(file);
  const styles = useStyles(attachmentPillStyles);
  return (
    <div style={styles.root}>
      {preview ? <img src={preview} alt="" style={styles.thumb} /> : null}
      <span style={styles.name}>{file.name}</span>
      <span style={styles.size}>{formatSize(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        style={styles.remove}
      >
        ×
      </button>
    </div>
  );
}
