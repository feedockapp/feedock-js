"use client";

import type { ReactNode } from "react";

import { homeStyles } from "./home-styles";
import { useStyles } from "../../shared/lib/use-styles";
import { SeeAllButton } from "./home-see-all-button";

export type Props = {
  title: string;
  icon: ReactNode;
  onSeeAll?: () => void;
  seeAllLabel: string;
  children: ReactNode;
};

/** Section wrapper: an icon + uppercase title + a "See all →" affordance, then rows. */
export function HomeSection({
  title,
  icon,
  onSeeAll,
  seeAllLabel,
  children,
}: Props) {
  const styles = useStyles(homeStyles);

  return (
    <section>
      <div style={styles.sectionHead}>
        <span style={styles.sectionTitleWrap}>
          <span style={styles.sectionIcon}>{icon}</span>
          <span style={styles.sectionTitle}>{title}</span>
        </span>
        {onSeeAll ? (
          <SeeAllButton label={seeAllLabel} onClick={onSeeAll} />
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
