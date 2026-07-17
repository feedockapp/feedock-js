// @feedock/react — embed a Feedock feedback board, roadmap, and changelog in
// your React app. See docs/features/integration.md.

export { FeedockProvider, useFeedockContext } from "./context";
export type { FeedockProviderProps, VisitorIdentity } from "./context";
export { useFeedock } from "./use-feedock";
export { useUnreadUpdate } from "./features/changelog";
export type { UnreadUpdate } from "./features/changelog";
export { FeedbackBoard } from "./features/feedback";
export type { FeedbackBoardProps } from "./features/feedback";
export { Home } from "./features/home";
export type { HomeProps } from "./features/home";
export { Composer } from "./features/submit";
export { Roadmap } from "./features/roadmap";
export { Changelog } from "./features/changelog";
export { LatestUpdate } from "./features/changelog";
export { Spinner } from "./shared/ui/spinner";
export { FeedockClient } from "./client";
export type {
  FeedbackQuery,
  StartIdentityResult,
  VerifyIdentityResult,
  VoteResult,
  FollowResult,
  SubscribeResult,
} from "./client";
export type * from "./types";
