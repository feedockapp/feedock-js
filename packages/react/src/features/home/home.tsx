"use client";

import { type ReactNode, useState } from "react";

import { useFeedockContext } from "../../context";
import { statusTone, type ResolvedTheme } from "../../theme";
import type {
  PublicFeedbackListItem,
  PublicRoadmapItem,
  PublicUpdate,
} from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { SpinnerBlock } from "../../shared/ui/spinner";
import { toExcerpt, useChangelog } from "../changelog";
import { StatusIcon, useTrendingFeedback } from "../feedback";
import { useRoadmap } from "../roadmap";
import { formatShortDate } from "./home-format";
import { homeStyles } from "./home-styles";
import {
  ProgressSectionIcon,
  TrendingSectionIcon,
  UpdatesSectionIcon,
} from "./home-icons";

type Styles = ReturnType<typeof homeStyles>;

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

/** A small up-caret for the vote/asked pills. */
function Caret({ color }: { color: string }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 15l7-7 7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "See all →" affordance — color brightens on hover (matches the nav). */
function SeeAllButton({
  label,
  onClick,
  styles,
}: {
  label: string;
  onClick: () => void;
  styles: Styles;
}) {
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

/** Section wrapper: an icon + uppercase title + a "See all →" affordance, then rows. */
function HomeSection({
  title,
  icon,
  onSeeAll,
  seeAllLabel,
  styles,
  children,
}: {
  title: string;
  icon: ReactNode;
  onSeeAll?: () => void;
  seeAllLabel: string;
  styles: Styles;
  children: ReactNode;
}) {
  return (
    <section>
      <div style={styles.sectionHead}>
        <span style={styles.sectionTitleWrap}>
          <span style={styles.sectionIcon}>{icon}</span>
          <span style={styles.sectionTitle}>{title}</span>
        </span>
        {onSeeAll ? (
          <SeeAllButton label={seeAllLabel} onClick={onSeeAll} styles={styles} />
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

/** The latest published update, as a tappable hero card. */
function HomeHero({
  update,
  styles,
  onOpen,
}: {
  update: PublicUpdate;
  styles: Styles;
  onOpen?: () => void;
}) {
  const excerpt = update.whyItMatters || toExcerpt(update.body, 150);
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.hero}
    >
      {update.coverImageUrl ? (
        // The Home hero is the featured spot — show the entry's cover image.
        <img
          src={update.coverImageUrl}
          alt=""
          style={{
            width: "100%",
            maxHeight: 160,
            objectFit: "cover",
            borderRadius: 10,
            display: "block",
            marginBottom: 12,
          }}
        />
      ) : null}
      <div style={styles.heroEyebrow}>
        {update.category.toUpperCase()}
        <span style={styles.heroEyebrowDate}>
          · {formatShortDate(update.publishedAt)}
        </span>
      </div>
      <h3 style={styles.heroTitle(hover)}>{update.title}</h3>
      {excerpt ? <p style={styles.heroExcerpt}>{excerpt}</p> : null}
      {update.author ? (
        <span style={styles.heroAuthor}>
          <Avatar name={update.author.name} imageUrl={update.author.avatarUrl} size={20} />
          <span style={styles.heroAuthorName}>{update.author.name}</span>
        </span>
      ) : null}
    </button>
  );
}

/** One trending-feedback row: status dot + title/status + vote pill. */
function HomeFeedbackRow({
  item,
  first,
  theme,
  styles,
  onOpen,
}: {
  item: PublicFeedbackListItem;
  first: boolean;
  theme: ResolvedTheme;
  styles: Styles;
  onOpen?: () => void;
}) {
  const tone = statusTone(item.status);
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.row(first)}
    >
      <span style={styles.statusIcon(tone.fg)}>
        <StatusIcon status={item.status} />
      </span>
      <span style={styles.rowMain}>
        <span style={styles.rowTitle(hover)}>{item.title}</span>
        <span style={styles.rowSub}>{tone.label}</span>
      </span>
      <span style={styles.votePill}>
        <Caret color={theme.brand} />
        {item.voteCount}
      </span>
    </button>
  );
}

/** One in-progress roadmap row: title + "who asked" pill. */
function HomeRoadmapRow({
  item,
  first,
  theme,
  styles,
  onOpen,
}: {
  item: PublicRoadmapItem;
  first: boolean;
  theme: ResolvedTheme;
  styles: Styles;
  onOpen?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.row(first)}
    >
      <span style={styles.rowMain}>
        <span style={styles.rowTitle(hover)}>{item.title}</span>
      </span>
      {item.peopleAsked > 0 ? (
        <span style={styles.votePill}>
          <Caret color={theme.brand} />
          {item.peopleAsked}
        </span>
      ) : null}
    </button>
  );
}

/** One recent-update row: date + title. */
function HomeUpdateRow({
  update,
  first,
  styles,
  onOpen,
}: {
  update: PublicUpdate;
  first: boolean;
  styles: Styles;
  onOpen?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.row(first)}
    >
      <span style={styles.updateDate}>{formatShortDate(update.publishedAt)}</span>
      <span style={styles.rowMain}>
        <span style={styles.rowTitle(hover)}>{update.title}</span>
      </span>
    </button>
  );
}

/**
 * The curated Home tab — latest update hero, trending feedback, in-progress
 * roadmap, and recent updates. Each section renders only when its content tab
 * is enabled; "See all" + row taps jump to that tab via `onNavigate`. Data
 * reuses the SDK's changelog/roadmap/feedback fetches (one call each).
 */
export function Home({ tabs, onNavigate, reloadKey = 0 }: HomeProps) {
  const { theme } = useFeedockContext();
  const styles = homeStyles(theme);

  const { items: updates } = useChangelog(reloadKey);
  const { columns } = useRoadmap(reloadKey);
  const { items: trending, loading: trendingLoading } =
    useTrendingFeedback(reloadKey);

  const showFeedback = tabs.includes("feedback");
  const showRoadmap = tabs.includes("roadmap");
  const showUpdates = tabs.includes("updates");

  const hero = showUpdates ? updates[0] : undefined;
  const recentUpdates = showUpdates ? updates.slice(1, 1 + MAX_ROWS) : [];
  const inProgress = showRoadmap
    ? (columns.find((c) => c.column === "Now")?.items ?? []).slice(0, MAX_ROWS)
    : [];
  const topFeedback = showFeedback ? trending.slice(0, MAX_ROWS) : [];

  const go = (tab: string) => () => onNavigate?.(tab);

  // Build the visible groups, then join them with a divider between each.
  const groups: ReactNode[] = [];
  if (hero) {
    groups.push(
      <HomeHero
        key="hero"
        update={hero}
        styles={styles}
        onOpen={() => onNavigate?.("updates", hero.id)}
      />,
    );
  }
  if (showFeedback) {
    groups.push(
      <HomeSection
        key="trending"
        title="Trending"
        icon={<TrendingSectionIcon />}
        seeAllLabel="See all"
        onSeeAll={go("feedback")}
        styles={styles}
      >
        {topFeedback.length > 0 ? (
          topFeedback.map((item, i) => (
            <HomeFeedbackRow
              key={item.id}
              item={item}
              first={i === 0}
              theme={theme}
              styles={styles}
              onOpen={() => onNavigate?.("feedback", item.id)}
            />
          ))
        ) : trendingLoading ? (
          <SpinnerBlock size={18} />
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
        onSeeAll={go("roadmap")}
        styles={styles}
      >
        {inProgress.map((item, i) => (
          <HomeRoadmapRow
            key={item.id}
            item={item}
            first={i === 0}
            theme={theme}
            styles={styles}
            onOpen={() => onNavigate?.("roadmap", item.id)}
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
        onSeeAll={go("updates")}
        styles={styles}
      >
        {recentUpdates.map((update, i) => (
          <HomeUpdateRow
            key={update.id}
            update={update}
            first={i === 0}
            styles={styles}
            onOpen={() => onNavigate?.("updates", update.id)}
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
          : [
              <div key={`divider-${i}`} style={styles.groupDivider} />,
              group,
            ],
      )}
    </div>
  );
}
