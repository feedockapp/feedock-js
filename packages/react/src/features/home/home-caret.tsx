"use client";

export type Props = {
  color: string;
};

/** A small up-caret for the vote/asked pills. */
export function Caret({ color }: Props) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 15l7-7 7 7"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
