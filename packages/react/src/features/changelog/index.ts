// features/changelog — the "What's New" feed, the latest-update toast, and the
// seen/unread bookkeeping they share. Higher layers import only from this barrel.

export { Changelog } from "./changelog";
export { LatestUpdate } from "./latest-update";
export { toExcerpt } from "./latest-update-text";
export { useChangelog } from "./use-changelog";
export { useUnreadUpdate } from "./use-unread-update";
export type { UnreadUpdate } from "./use-unread-update";
