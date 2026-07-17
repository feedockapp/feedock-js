"use client";

import { useState } from "react";

import { homeStyles } from "./home-styles";
import { useStyles } from "../../shared/lib/use-styles";

export type Props = {
  label: string;
  onClick: () => void;
};

/** "See all →" affordance — color brightens on hover (matches the nav). */
export function SeeAllButton({ label, onClick }: Props) {
  const styles = useStyles(homeStyles);
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.seeAll(hover)}
    >
      {label} <span aria-hidden>→</span>
    </button>
  );
}
