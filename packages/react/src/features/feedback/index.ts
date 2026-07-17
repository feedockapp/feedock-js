// features/feedback — the board, its list/detail, and the feedback hooks.
// Higher layers import only from this barrel.

export { FeedbackBoard } from "./feedback-board";
export type { FeedbackBoardProps } from "./feedback-board";
export { StatusIcon } from "./feedback-card-icons";
export { useTrendingFeedback } from "./use-trending-feedback";
