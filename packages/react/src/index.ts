// @feedock/react — embed a Feedock feedback board, roadmap, and changelog in
// your React app. See docs/features/integration.md.

export { FeedockProvider, useFeedockContext } from "./context";
export type {
  FeedockContextValue,
  FeedockProviderProps,
  VisitorIdentity,
} from "./context";
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
// Host-controllable typography — set `--feedock-font-size` / `--feedock-font-family`
// to scale the panel's type. `fs()` is exported so the widget shell sizes with us.
export {
  fs,
  BASE_FONT_SIZE,
  BASE_FONT_SIZE_PX,
  FONT_SIZE_VAR,
  FONT_FAMILY_VAR,
} from "./type-scale";
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
