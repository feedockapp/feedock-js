"use client";

import { useCallback, useEffect, useState } from "react";

import { useFeedockContext } from "../../context";
import { readSeenUpdate, writeSeenUpdate } from "./seen";

export type UnreadUpdate = {
  /** True when the newest published update is newer than the one last seen. */
  hasUnread: boolean;
  /** Mark the newest update as seen (clears the badge until the next one). */
  markSeen: () => void;
};

/**
 * Whether there's an unread "What's New" update for this visitor — drives the
 * launcher's badge. Shares the per-project last-seen key with `<LatestUpdate>`,
 * so dismissing the toast also clears the badge (and vice-versa).
 */
export function useUnreadUpdate(): UnreadUpdate {
  const { client, slug } = useFeedockContext();
  const [latestId, setLatestId] = useState<string | null>(null);
  const [seenId, setSeenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSeenId(readSeenUpdate(slug));
    client
      .listUpdates()
      .then((page) => {
        if (active) {
          setLatestId(page.items[0]?.id ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client, slug]);

  const markSeen = useCallback(() => {
    if (latestId) {
      writeSeenUpdate(slug, latestId);
      setSeenId(latestId);
    }
  }, [latestId, slug]);

  return { hasUnread: latestId !== null && latestId !== seenId, markSeen };
}
