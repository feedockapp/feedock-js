/**
 * Public read-model types returned by the Feedock public API. Mirrors
 * apps/api/src/public/model/public.model.ts. Kept self-contained (no internal
 * imports) so the published SDK has no Feedock workspace dependencies.
 *
 * Fields documented "safe HTML" are sanitized/escaped server-side; render them
 * with the provided components (which use them safely). All other strings are
 * plain text.
 */

export type FeedbackStatus =
  "Open" | "UnderReview" | "Planned" | "InProgress" | "Shipped" | "Declined";

export type FeedbackKind = "Request" | "Bug" | "Idea";
export type RoadmapColumn = "Now" | "Next" | "Later" | "Shipped";
export type ChangelogCategory = "New" | "Improved" | "Fixed";

export interface PublicBoard {
  name: string;
  slug: string | null;
}

export interface PublicProjectConfig {
  slug: string;
  name: string;
  logoUrl: string | null;
  /** Light-surface accent (and the dark fallback); null = Feedock default. */
  brandColor: string | null;
  /** Dark-surface accent; null falls back to `brandColor`. */
  brandColorDark: string | null;
  themeMode: string;
  tabsEnabled: string[];
  showProgress: boolean;
  /** White-label: when true, hide the "Powered by Feedock" footer. */
  hideBranding: boolean;
  launcherPosition: string;
  boards: PublicBoard[];
}

export interface PublicFeedbackListItem {
  id: string;
  title: string;
  body: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  voteCount: number;
  requesterCount: number;
  /** PUBLIC, non-hidden replies. */
  commentCount: number;
  board: PublicBoard | null;
  /** Original submitter — display name only, when they have one. */
  author: PublicAuthor | null;
  createdAt: string;
}

/** A public author reference — a display name only, never an email. */
export interface PublicAuthor {
  name: string;
  /** Absolute avatar URL, or null → the client falls back to a letter-avatar. */
  avatarUrl?: string | null;
}

/**
 * A PUBLIC feedback item found near a draft (dedupe-at-submit "upvote instead?").
 * Returned by the pre-submit similarity check; narrow + public-safe.
 */
export interface SimilarFeedback {
  id: string;
  title: string;
  voteCount: number;
  status: FeedbackStatus;
  /** Cosine similarity 0..1 (1 = identical). */
  similarity: number;
}

export interface PublicComment {
  id: string;
  body: string;
  authorName: string;
  isOfficial: boolean;
  createdAt: string;
}

/** An uploaded image / video / file on a public feedback item. */
export interface PublicAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
  isVideo: boolean;
  /** Safe to render inline (image / video / pdf). */
  inline: boolean;
  /** Relative download path (`/public/p/:slug/attachments/:id`). */
  downloadUrl: string;
}

export interface PublicFeedbackDetail extends PublicFeedbackListItem {
  comments: PublicComment[];
  attachments: PublicAttachment[];
}

/** Live progress of a PUBLIC milestone linked to a roadmap item. */
export interface PublicRoadmapMilestone {
  title: string;
  status: string;
  /** Derived 0–100 (Shipped pins to 100). */
  progress: number;
}

export interface PublicRoadmapItem {
  id: string;
  title: string;
  description: string;
  column: RoadmapColumn;
  progress: number | null;
  /** Sum of requesterCount across linked public feedback ("X people asked"). */
  peopleAsked: number;
  /** Linked PUBLIC milestone's live progress, or null. */
  milestone: PublicRoadmapMilestone | null;
  /** When it shipped (Shipped column), ISO — null otherwise. */
  shippedAt: string | null;
  /** The earliest linked feedback's submitter (display name only), or null. */
  author: PublicAuthor | null;
}

export interface PublicRoadmapColumnGroup {
  column: RoadmapColumn;
  items: PublicRoadmapItem[];
}

export interface PublicUpdate {
  id: string;
  slug: string;
  title: string;
  category: ChangelogCategory;
  whyItMatters: string | null;
  body: string;
  /** Absolute URL of the cover/hero image (gated proxy), or null. */
  coverImageUrl: string | null;
  publishedAt: string;
  /** The member who published it (name + optional avatar), or null. */
  author: PublicAuthor | null;
}

export interface PublicPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Theme overrides a host app can pass to the provider. */
export interface FeedockTheme {
  /** Hex accent; defaults to the project's configured brandColor. */
  brandColor?: string;
  /**
   * Hex accent used when the resolved mode is dark. Falls back to
   * `brandColor`, then the project's configured dark/light colors.
   */
  brandColorDark?: string;
  /**
   * "light" / "dark" pin the palette. "auto" (or unset) defers to the
   * project's saved Widget-appearance theme — and when that setting is Auto,
   * to the visitor's `prefers-color-scheme` (tracked live).
   */
  mode?: "light" | "dark" | "auto";
}
