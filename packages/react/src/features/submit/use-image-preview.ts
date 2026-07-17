"use client";

import { useEffect, useState } from "react";

/**
 * A live object-URL thumbnail for image files (revoked on unmount), else null.
 *
 * The effect owns the object URL's lifecycle: it must stay. Dropping it leaks
 * one blob URL per picked file for the life of the page, and the cleanup is the
 * only thing that frees the previous URL when `file` changes.
 */
export function useImagePreview(file: File): string | null {
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
