"use client";

import { useState } from "react";

import { useFeedockContext } from "../../context";

type Props = {
  name: string;
  /** Avatar image when defined; falls back to the letter-avatar if absent or it fails to load. */
  imageUrl?: string | null;
  size?: number;
};

/**
 * The author avatar: their image when defined, otherwise a neutral letter-avatar
 * (their initial in a subtle circle). A broken image also degrades to the letter.
 */
export function Avatar({ name, imageUrl, size = 18 }: Props) {
  const { theme } = useFeedockContext();
  const dark = theme.mode === "dark";
  const [broken, setBroken] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase() || "?";

  const base = {
    width: size,
    height: size,
    borderRadius: 999,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
  } as const;

  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        style={{ ...base, objectFit: "cover" }}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{
        ...base,
        color: dark ? "rgba(255,255,255,0.75)" : theme.text,
        fontSize: Math.round(size * 0.5),
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
}
