/**
 * Per-project "last seen update" persistence (localStorage). Shared by the
 * `<LatestUpdate>` toast and the launcher's unread badge so they never drift —
 * dismissing one marks the update seen for both.
 */
/** Internal: the localStorage key for a project's last-seen update id. */
const seenUpdateKey = (slug: string): string => `feedock:${slug}:seen-update`;

export function readSeenUpdate(slug: string): string | null {
  try {
    return window.localStorage.getItem(seenUpdateKey(slug));
  } catch {
    return null;
  }
}

export function writeSeenUpdate(slug: string, id: string): void {
  try {
    window.localStorage.setItem(seenUpdateKey(slug), id);
  } catch {
    // Non-persistent (private mode / blocked storage) is acceptable.
  }
}
