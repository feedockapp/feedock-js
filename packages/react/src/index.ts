// @feedock/react — embed a Feedock feedback board, roadmap, and changelog in
// your React app. See docs/features/integration.md.

export { FeedockProvider, useFeedockContext } from "./context";
export type { FeedockProviderProps, VisitorIdentity } from "./context";
export { useFeedock } from "./use-feedock";
export { useUnreadUpdate } from "./hooks/use-unread-update";
export type { UnreadUpdate } from "./hooks/use-unread-update";
export { FeedbackBoard } from "./components/feedback-board";
export type { FeedbackBoardProps } from "./components/feedback-board";
export { Home } from "./components/home";
export type { HomeProps } from "./components/home";
export { Composer } from "./components/composer";
export { Roadmap } from "./components/roadmap";
export { Changelog } from "./components/changelog";
export { LatestUpdate } from "./components/latest-update";
export { Spinner } from "./components/spinner";
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
