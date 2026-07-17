"use client";

import { memo } from "react";

import { clampProgress } from "./roadmap-columns";
import { roadmapStyles } from "./roadmap-styles";
import { useStyles } from "../../shared/lib/use-styles";
import type { PublicRoadmapMilestone } from "../../types";

export type Props = {
  milestone: PublicRoadmapMilestone;
};

/** Linked public milestone's live progress. */
function RoadmapMilestoneProgressImpl({ milestone }: Props) {
  const styles = useStyles(roadmapStyles);
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

/**
 * Memoized: `milestone` is now the only prop (the style map it used to be handed
 * it reads itself), and it's an object straight off the roadmap fetch — its
 * identity holds until the next refetch. The win is the parent card's hover
 * re-render, which no longer redraws the progress bar underneath it.
 */
export const RoadmapMilestoneProgress = memo(RoadmapMilestoneProgressImpl);
