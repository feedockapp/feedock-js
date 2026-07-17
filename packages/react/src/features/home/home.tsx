"use client";

import { useCallback, type ReactNode } from "react";

import { useStyles } from "../../shared/lib/use-styles";
import { SpinnerBlock } from "../../shared/ui/spinner";
import { useChangelog } from "../changelog";
import { useTrendingFeedback } from "../feedback";
import { ROADMAP_COLUMN, useRoadmap } from "../roadmap";
import { HomeFeedbackRow } from "./home-feedback-row";
import { HomeHero } from "./home-hero";
import {
  ProgressSectionIcon,
  TrendingSectionIcon,
  UpdatesSectionIcon,
} from "./home-icons";
import { HomeRoadmapRow } from "./home-roadmap-row";
import { HomeSection } from "./home-section";
import { homeStyles } from "./home-styles";
import { HomeUpdateRow } from "./home-update-row";

export type HomeProps = {
  /** Content tabs the founder enabled — a section shows only if its tab is on. */
  tabs: string[];
  /**
   * Jump to a content tab from a "See all"/row click. A row passes its item id
   * so the target tab can open that item's detail (deep-link).
   */
  onNavigate?: (tab: string, itemId?: string) => void;
  /** Bumped when the host re-opens the widget — refetch every section (fresh). */
  reloadKey?: number;
};

const MAX_ROWS = 3;

/** The content tabs Home can surface a section for. */
const HOME_TAB = {
  Feedback: "feedback",
  Roadmap: "roadmap",
  Updates: "updates",
} as const;

/**
 * The curated Home tab — latest update hero, trending feedback, in-progress
 * roadmap, and recent updates. Each section renders only when its content tab
 * is enabled; "See all" + row taps jump to that tab via `onNavigate`. Data
 * reuses the SDK's changelog/roadmap/feedback fetches (one call each).
 */
export function Home({ tabs, onNavigate, reloadKey = 0 }: HomeProps) {
  const styles = useStyles(homeStyles);

  const { items: updates } = useChangelog(reloadKey);
  const { columns } = useRoadmap(reloadKey);
  const {
    items: trending,
    loading: trendingLoading,
    error: trendingError,
  } = useTrendingFeedback(reloadKey);

  const showFeedback = tabs.includes(HOME_TAB.Feedback);
  const showRoadmap = tabs.includes(HOME_TAB.Roadmap);
  const showUpdates = tabs.includes(HOME_TAB.Updates);

  const hero = showUpdates ? updates[0] : undefined;
  const recentUpdates = showUpdates ? updates.slice(1, 1 + MAX_ROWS) : [];
  const inProgress = showRoadmap
    ? (columns.find((c) => c.column === ROADMAP_COLUMN.Now)?.items ?? []).slice(
        0,
        MAX_ROWS,
      )
    : [];
  const topFeedback = showFeedback ? trending.slice(0, MAX_ROWS) : [];

  // One callback per destination, each taking the row's id — so a row never
  // needs a closure of its own and every row in a section shares one handler.
  const openFeedback = useCallback(
    (id: string) => onNavigate?.(HOME_TAB.Feedback, id),
    [onNavigate],
  );
  const openRoadmap = useCallback(
    (id: string) => onNavigate?.(HOME_TAB.Roadmap, id),
    [onNavigate],
  );
  const openUpdate = useCallback(
    (id: string) => onNavigate?.(HOME_TAB.Updates, id),
    [onNavigate],
  );
  // One per section rather than a seeAll(tab) factory: the factory's useCallback
  // stabilized the factory, while every call still minted a fresh arrow — so the
  // props these feed changed on every render anyway. The tabs are constants, so
  // three named callbacks are simpler and actually stable.
  const seeFeedback = useCallback(
    () => onNavigate?.(HOME_TAB.Feedback),
    [onNavigate],
  );
  const seeRoadmap = useCallback(
    () => onNavigate?.(HOME_TAB.Roadmap),
    [onNavigate],
  );
  const seeUpdates = useCallback(
    () => onNavigate?.(HOME_TAB.Updates),
    [onNavigate],
  );

  // Build the visible groups, then join them with a divider between each.
  const groups: ReactNode[] = [];
  if (hero) {
    groups.push(<HomeHero key="hero" update={hero} onOpen={openUpdate} />);
  }
  if (showFeedback) {
    groups.push(
      <HomeSection
        key="trending"
        title="Trending"
        icon={<TrendingSectionIcon />}
        seeAllLabel="See all"
        onSeeAll={seeFeedback}
      >
        {topFeedback.length > 0 ? (
          topFeedback.map((item, i) => (
            <HomeFeedbackRow
              key={item.id}
              item={item}
              first={i === 0}
              onOpen={openFeedback}
            />
          ))
        ) : trendingLoading ? (
          <SpinnerBlock size={18} />
        ) : trendingError ? (
          // A failed load is not an empty board — don't imply there's nothing.
          <p style={styles.empty}>Couldn&apos;t load feedback.</p>
        ) : (
          <p style={styles.empty}>No feedback yet.</p>
        )}
      </HomeSection>,
    );
  }
  if (showRoadmap && inProgress.length > 0) {
    groups.push(
      <HomeSection
        key="in-progress"
        title="In progress"
        icon={<ProgressSectionIcon />}
        seeAllLabel="See roadmap"
        onSeeAll={seeRoadmap}
      >
        {inProgress.map((item, i) => (
          <HomeRoadmapRow
            key={item.id}
            item={item}
            first={i === 0}
            onOpen={openRoadmap}
          />
        ))}
      </HomeSection>,
    );
  }
  if (showUpdates && recentUpdates.length > 0) {
    groups.push(
      <HomeSection
        key="updates"
        title="Updates"
        icon={<UpdatesSectionIcon />}
        seeAllLabel="See all"
        onSeeAll={seeUpdates}
      >
        {recentUpdates.map((update, i) => (
          <HomeUpdateRow
            key={update.id}
            update={update}
            first={i === 0}
            onOpen={openUpdate}
          />
        ))}
      </HomeSection>,
    );
  }

  return (
    <div style={styles.container}>
      {groups.flatMap((group, i) =>
        i === 0
          ? [group]
          : [<div key={`divider-${i}`} style={styles.groupDivider} />, group],
      )}
    </div>
  );
}
