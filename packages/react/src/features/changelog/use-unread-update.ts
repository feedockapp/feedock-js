"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { useFeedockContext } from "../../context";
import { readSeenUpdate, subscribeSeenUpdate, writeSeenUpdate } from "./seen";

export type UnreadUpdate = {
  /** True when the newest published update is newer than the one last seen. */
  hasUnread: boolean;
  /** Mark the newest update as seen (clears the badge until the next one). */
  markSeen: () => void;
};

/**
 * Whether there's an unread "What's New" update for this visitor — drives the
 * launcher's badge. Subscribes to the per-project last-seen key that
 * `<LatestUpdate>` writes, so dismissing the toast clears the badge too.
 */
export function useUnreadUpdate(): UnreadUpdate {
  const { client, slug } = useFeedockContext();
  const [latestId, setLatestId] = useState<string | null>(null);

  // Subscribed, not snapshotted into state on mount: the toast writes this key
  // and the badge has to notice. Reading it once left the badge lit after a
  // dismiss until something happened to remount it.
  const seenId = useSyncExternalStore(
    subscribeSeenUpdate,
    () => readSeenUpdate(slug),
    // No localStorage while server-rendering — nothing is seen yet.
    () => null,
  );

  useEffect(() => {
    let active = true;
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
    // `client` alone: there is one per (apiBase, slug), so it already changes
    // when the project does. exhaustive-deps doesn't flag a redundant dep, so
    // the leftover `slug` here sat harmless but lying about what this reads.
  }, [client]);

  const markSeen = useCallback(() => {
    if (latestId) {
      // No local setState: the write notifies every subscriber, this one
      // included, so one path keeps the toast and the badge in agreement.
      writeSeenUpdate(slug, latestId);
    }
  }, [latestId, slug]);

  return useMemo(
    () => ({ hasUnread: latestId !== null && latestId !== seenId, markSeen }),
    [latestId, seenId, markSeen],
  );
}
