"use client";

import { clampProgress } from "./roadmap-columns";
import type { RoadmapStyles } from "./roadmap-styles";
import type { PublicRoadmapMilestone } from "../../types";

type Props = {
  milestone: PublicRoadmapMilestone;
  styles: RoadmapStyles;
};

/** Linked public milestone's live progress. */
export function RoadmapMilestoneProgress({ milestone, styles }: Props) {
  const percent = clampProgress(milestone.progress);

  return (
    <div style={styles.milestone}>
      <div style={styles.milestoneHeader}>
        <span style={styles.milestoneTitle}>{milestone.title}</span>
        <span style={styles.milestonePercent}>{percent}%</span>
      </div>
      <div style={styles.progressTrack}>
        <div style={styles.progressFill(percent)} />
      </div>
    </div>
  );
}
