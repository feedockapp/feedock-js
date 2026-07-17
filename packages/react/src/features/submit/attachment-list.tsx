"use client";

import type { CSSProperties } from "react";

import { AttachmentPill } from "./attachment-pill";

export type Props = {
  files: File[];
  onRemove: (index: number) => void;
};

/** Fully static (no theme/state deps) — hoisted so it isn't rebuilt each render. */
const LIST_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

/** The picked-but-not-yet-uploaded file list in the SDK composer. */
export function AttachmentList({ files, onRemove }: Props) {
  if (files.length === 0) {
    return null;
  }
  return (
    <div style={LIST_STYLE}>
      {files.map((file, index) => (
        <AttachmentPill
          // Keyed on the file's own identity, not its index — removing file 0
          // otherwise renumbers every later key, remounting each pill and
          // churning its object-URL thumbnail.
          key={`${file.name}-${file.size}-${file.lastModified}`}
          file={file}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}
