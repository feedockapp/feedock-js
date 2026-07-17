"use client";

import { AttachmentPill } from "./attachment-pill";

type Props = {
  files: File[];
  onRemove: (index: number) => void;
};

/** The picked-but-not-yet-uploaded file list in the SDK composer. */
export function AttachmentList({ files, onRemove }: Props) {
  if (files.length === 0) {
    return null;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {files.map((file, index) => (
        <AttachmentPill
          key={`${file.name}-${file.size}-${index}`}
          file={file}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}
