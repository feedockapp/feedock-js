import type {
  PublicAttachment,
  PublicFeedbackDetail,
  PublicFeedbackListItem,
  PublicPage,
  PublicProjectConfig,
  PublicRoadmapColumnGroup,
  PublicUpdate,
  SimilarFeedback,
} from "./types";

/**
 * Convert the composer's plain-text body into safe HTML before submit. Feedback
 * bodies are rich-text HTML at rest; the lean SDK has no editor, so we escape
 * the text (so "a < b" survives the server's HTML sanitizer) and turn newlines
 * into <br>. The API sanitizes again server-side.
 */
function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped
    .split(/\r?\n/)
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}

export interface StartIdentityResult {
  sent: boolean;
  /** Present only in the API's non-production mode (for local testing). */
  devToken?: string;
}
export interface VerifyIdentityResult {
  token: string;
  email: string;
}
export interface VoteResult {
  voteCount: number;
  voted: boolean;
}
export interface FollowResult {
  following: boolean;
}
export interface SubscribeResult {
  confirmed: boolean;
  devToken?: string;
}

export interface FeedbackQuery {
  sort?: "top" | "new";
  board?: string;
  cursor?: string;
  /** Free-text search across title + body (server-side, all pages). */
  q?: string;
}

/**
 * Thin browser client for the Feedock public REST API. Reads need no auth;
 * writes pass a verified-visitor token (obtained via the magic-link identity
 * flow) as a Bearer header. One instance per (apiBase, projectSlug).
 */
export class FeedockClient {
  /** Config is fetched by the provider AND components — share one request. */
  private configPromise: Promise<PublicProjectConfig> | null = null;

  constructor(
    private readonly apiBase: string,
    private readonly slug: string,
  ) {}

  private url(path: string): string {
    const base = this.apiBase.replace(/\/$/, "");
    return `${base}/public/p/${encodeURIComponent(this.slug)}${path}`;
  }

  private async request<T>(
    path: string,
    init?: RequestInit & { token?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (init?.body) {
      headers["content-type"] = "application/json";
    }
    if (init?.token) {
      headers["authorization"] = `Bearer ${init.token}`;
    }
    const res = await fetch(this.url(path), { ...init, headers });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const data = (await res.json()) as { message?: string };
        if (data?.message) {
          message = data.message;
        }
      } catch {
        // non-JSON error; keep the status message
      }
      throw new Error(message);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  // --- reads ---------------------------------------------------------------

  getConfig(): Promise<PublicProjectConfig> {
    // Memoized: the provider (theme) and components (branding) both need it.
    // A failed fetch clears the cache so the next call can retry.
    this.configPromise ??= this.request<PublicProjectConfig>("/config").catch(
      (err: unknown) => {
        this.configPromise = null;
        throw err;
      },
    );
    return this.configPromise;
  }

  listFeedback(
    query: FeedbackQuery = {},
  ): Promise<PublicPage<PublicFeedbackListItem>> {
    const params = new URLSearchParams();
    if (query.sort) {
      params.set("sort", query.sort);
    }
    if (query.board) {
      params.set("board", query.board);
    }
    if (query.cursor) {
      params.set("cursor", query.cursor);
    }
    if (query.q) {
      params.set("q", query.q);
    }
    const qs = params.toString();
    return this.request(`/feedback${qs ? `?${qs}` : ""}`);
  }

  getItem(id: string): Promise<PublicFeedbackDetail> {
    return this.request(`/feedback/${encodeURIComponent(id)}`);
  }

  getRoadmap(): Promise<PublicRoadmapColumnGroup[]> {
    return this.request("/roadmap");
  }

  listUpdates(cursor?: string): Promise<PublicPage<PublicUpdate>> {
    return this.request(
      `/updates${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
  }

  /**
   * Pre-submit dedupe: PUBLIC feedback similar to a draft, so the composer can
   * offer "looks similar — upvote instead?". No token (reads only public data);
   * returns [] when the project has embeddings disabled.
   */
  similarFeedback(input: {
    title: string;
    body?: string;
  }): Promise<SimilarFeedback[]> {
    return this.request("/feedback/similar", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // --- account-less identity ----------------------------------------------

  startIdentity(email: string): Promise<StartIdentityResult> {
    return this.request("/identity/start", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  verifyIdentity(token: string): Promise<VerifyIdentityResult> {
    return this.request("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Exchange a host-signed SSO token (identified user) for a verified-visitor
   * session — skips the email magic-link. The token must be signed by your
   * backend with the project's SSO secret (see docs).
   */
  exchangeSso(token: string): Promise<VerifyIdentityResult> {
    return this.request("/identity/sso", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  // --- verified-visitor writes --------------------------------------------

  submitFeedback(
    token: string,
    input: {
      title: string;
      body: string;
      boardSlug?: string;
      /** Opt in to the "it shipped" email for this item (H-01). */
      notifyMe?: boolean;
    },
  ): Promise<PublicFeedbackListItem> {
    return this.request("/feedback", {
      method: "POST",
      token,
      body: JSON.stringify({ ...input, body: plainTextToHtml(input.body) }),
    });
  }

  /**
   * Upload one image/video/file onto a just-created feedback item. Multipart, so
   * it bypasses the JSON `request` helper — the browser sets the multipart
   * boundary Content-Type itself.
   */
  async uploadAttachment(
    token: string,
    feedbackId: string,
    file: File,
  ): Promise<PublicAttachment> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      this.url(`/feedback/${encodeURIComponent(feedbackId)}/attachments`),
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      },
    );
    if (!res.ok) {
      let message = `Upload failed (${res.status})`;
      try {
        const data = (await res.json()) as { message?: string };
        if (data?.message) {
          message = data.message;
        }
      } catch {
        // non-JSON error; keep the status message
      }
      throw new Error(message);
    }
    return (await res.json()) as PublicAttachment;
  }

  vote(token: string, id: string): Promise<VoteResult> {
    return this.request(`/feedback/${encodeURIComponent(id)}/vote`, {
      method: "POST",
      token,
    });
  }

  /** Follow / unfollow a feedback item ("notify me when this ships"). */
  setFollow(
    token: string,
    id: string,
    following: boolean,
  ): Promise<FollowResult> {
    const action = following ? "follow" : "unfollow";
    return this.request(`/feedback/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      token,
    });
  }

  comment(token: string, id: string, body: string): Promise<unknown> {
    return this.request(`/feedback/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      token,
      body: JSON.stringify({ body }),
    });
  }

  subscribe(input: {
    email: string;
    consent: boolean;
    scope?: string;
    source?: string;
  }): Promise<SubscribeResult> {
    return this.request("/subscribe", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
