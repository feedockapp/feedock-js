"use client";

import { useEffect, useState } from "react";

import { useFeedockContext } from "../context";

type Props = { file: File; onRemove: () => void };

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** A live object-URL thumbnail for image files (revoked on unmount), else null. */
function useImagePreview(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

/** One picked-but-not-yet-uploaded file in the SDK composer. */
export function AttachmentPill({ file, onRemove }: Props) {
  const { theme } = useFeedockContext();
  const preview = useImagePreview(file);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        background: theme.bg,
        padding: "6px 8px",
      }}
    >
      {preview ? (
        <img
          src={preview}
          alt=""
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: 6,
            objectFit: "cover",
            border: `1px solid ${theme.border}`,
          }}
        />
      ) : null}
      <span
        style={{
          minWidth: 0,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 12,
          color: theme.text,
        }}
      >
        {file.name}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12, color: theme.muted }}>
        {formatSize(file.size)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        style={{
          flexShrink: 0,
          border: "none",
          background: "transparent",
          color: theme.muted,
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
