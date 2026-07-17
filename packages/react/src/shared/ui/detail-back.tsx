"use client";

import { detailBackStyles } from "./detail-back-styles";
import { useStyles } from "../lib/use-styles";

export type Props = {
  onBack: () => void;
};

/** "← Back" affordance shared by the roadmap + changelog detail views. */
export function DetailBack({ onBack }: Props) {
  const styles = useStyles(detailBackStyles);

  return (
    <button type="button" onClick={onBack} style={styles.root}>
      <span aria-hidden>←</span> Back
    </button>
  );
}
