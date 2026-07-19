"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { FeedockClient } from "./client";
import { resolveTheme, type ResolvedTheme } from "./theme";
import type { FeedockTheme, PublicProjectConfig } from "./types";

export interface VisitorIdentity {
  token: string;
  email: string;
}

/** True only for a well-formed persisted identity (both fields present strings). */
export function isVisitorIdentity(value: unknown): value is VisitorIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).token === "string" &&
    typeof (value as Record<string, unknown>).email === "string"
  );
}

/** Re-identify this early before a token's real expiry (never let a write 401). */
const TOKEN_REFRESH_SKEW_MS = 60_000;

/** Decode a JWT payload WITHOUT verifying (claims only — the API verifies). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) {
      return null;
    }
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** A stored visitor token still comfortably in its validity window. */
function isVisitorTokenFresh(token: string): boolean {
  const exp = decodeJwtPayload(token)?.exp;
  return (
    typeof exp === "number" && exp * 1000 - Date.now() > TOKEN_REFRESH_SKEW_MS
  );
}

/** The email a host SSO token asserts (for matching against a stored session). */
function ssoTokenEmail(token: string): string | null {
  const email = decodeJwtPayload(token)?.email;
  return typeof email === "string" ? email.toLowerCase() : null;
}

/**
 * Query param the cross-surface link handoff carries — a host-signed SSO token the
 * board trades in so a user linked from the product arrives already recognized.
 * Sign it single-use (`jti`) + short-lived; the board strips it on arrival.
 */
const SSO_HANDOFF_PARAM = "fdk_sso";

export interface FeedockContextValue {
  client: FeedockClient;
  slug: string;
  theme: ResolvedTheme;
  /** The project's public config; `null` until loaded (or if the fetch failed). */
  config: PublicProjectConfig | null;
  identity: VisitorIdentity | null;
  setIdentity: (identity: VisitorIdentity) => void;
  clearIdentity: () => void;
  /**
   * Resolve identity WITHOUT prompting: returns the current session, or awaits an
   * in-flight host-SSO auto-identify (`userToken` / `getUserToken`) and returns
   * its result, or `null` when there's nothing to resolve (anonymous visitor).
   * A write-gate calls this before showing the email prompt, so a signed-in host
   * user is recognized silently — the prompt only appears for a true anonymous.
   */
  ensureIdentity: () => Promise<VisitorIdentity | null>;
}

const FeedockContext = createContext<FeedockContextValue | null>(null);

const DEFAULT_API_BASE = "https://api.feedock.com";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The visitor's OS/browser dark preference, tracked live (SSR-safe: light). */
function useSystemDark(): boolean {
  const [dark, setDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return dark;
}

/**
 * The effective light/dark mode — the theme cascade:
 *   1. an explicit embed override ("light" / "dark" via the provider prop or
 *      the widget's data-mode) always wins;
 *   2. otherwise the project's saved Widget-appearance theme (Light / Dark);
 *   3. otherwise (setting Auto, config not loaded, or fetch failed) the
 *      visitor's prefers-color-scheme.
 */
function effectiveMode(
  requested: FeedockTheme["mode"],
  configTheme: string | undefined,
  systemDark: boolean,
): "light" | "dark" {
  if (requested === "light" || requested === "dark") {
    return requested;
  }
  const setting = configTheme?.toLowerCase();
  if (setting === "light" || setting === "dark") {
    return setting;
  }
  return systemDark ? "dark" : "light";
}

/**
 * The accent for the resolved mode — embed overrides win over the project's
 * saved colors, and on dark surfaces the dark variant wins over the light one
 * (`brandColorDark ?? brandColor` at each level). Undefined/null falls through
 * to the SDK default inside {@link resolveTheme}. Takes the override fields as
 * primitives so callers can memoize on them (an inline `theme={{…}}` object
 * must not bust the memo).
 */
function effectiveBrand(
  mode: "light" | "dark",
  overrideBrand: string | undefined,
  overrideBrandDark: string | undefined,
  config: PublicProjectConfig | null,
): string | null | undefined {
  if (mode === "dark") {
    return (
      overrideBrandDark ??
      overrideBrand ??
      config?.brandColorDark ??
      config?.brandColor
    );
  }
  return overrideBrand ?? config?.brandColor;
}

export interface FeedockProviderProps {
  /** The project's public slug (its `data-project` id). */
  projectSlug: string;
  /** Base URL of the Feedock public API. Defaults to the hosted API. */
  apiBase?: string;
  /** Optional theme overrides (brand color, light/dark). */
  theme?: FeedockTheme;
  /**
   * Host-signed SSO token for an already-authenticated user. When provided, the
   * SDK exchanges it on mount to recognize the user automatically — no email
   * verification. Sign it on YOUR backend with the project's SSO secret.
   */
  userToken?: string;
  /**
   * Lazy alternative to {@link userToken}: a resolver the SDK calls on mount to
   * fetch a host-signed token (e.g. `GET /feedock/identify` on your own origin,
   * which reads the user's session and signs a token, or returns null when
   * logged out). Lets a signed-in host user be recognized with zero action and
   * without threading a token into every render. `userToken` takes precedence.
   * Keep the function stable (memoize it) — it's read once per mount.
   */
  getUserToken?: () => Promise<string | null>;
  /**
   * Origins of YOUR Feedock board/roadmap/changelog (e.g.
   * `["https://feedback.acme.com"]`, or `["https://feedbase.app"]` for the hosted
   * portal). When set alongside `userToken`/`getUserToken`, the SDK auto-appends a
   * fresh single-use identity token to plain left-clicks navigating to those
   * origins — so a signed-in user who follows a link from your app lands on the
   * board already recognized (no email prompt). Opt-in + bounded to these origins;
   * modified clicks (new tab) and token failures fall through undecorated.
   */
  boardOrigins?: string[];
  children: ReactNode;
}

/**
 * Root provider for the Feedock React SDK. Wrap the part of your app that
 * renders Feedock components. Holds the API client, the resolved theme, and the
 * account-less visitor identity (a verified-visitor token persisted in
 * localStorage, scoped per project).
 */
export function FeedockProvider({
  projectSlug,
  apiBase,
  theme,
  userToken,
  getUserToken,
  boardOrigins,
  children,
}: FeedockProviderProps) {
  const client = useMemo(
    () => new FeedockClient(apiBase ?? DEFAULT_API_BASE, projectSlug),
    [apiBase, projectSlug],
  );

  // The project's public config drives the theme/brand defaults (and lets
  // components read tabs/branding without their own fetch). Best-effort: a
  // failed fetch leaves it null and the cascade falls through to the visitor's
  // system preference.
  const [config, setConfig] = useState<PublicProjectConfig | null>(null);
  useEffect(() => {
    let active = true;
    client
      .getConfig()
      .then((c) => {
        if (active) {
          setConfig(c);
        }
      })
      .catch(() => {
        if (active) {
          setConfig(null);
        }
      });
    return () => {
      active = false;
    };
  }, [client]);

  const systemDark = useSystemDark();
  // Primitive deps on purpose: hosts pass `theme={{…}}` inline (our own widget
  // does), so depending on the object identity would re-resolve every render.
  const requestedMode = theme?.mode;
  const overrideBrand = theme?.brandColor;
  const overrideBrandDark = theme?.brandColorDark;
  const resolved = useMemo(() => {
    const mode = effectiveMode(requestedMode, config?.themeMode, systemDark);
    return resolveTheme(
      mode,
      effectiveBrand(mode, overrideBrand, overrideBrandDark, config),
    );
  }, [requestedMode, overrideBrand, overrideBrandDark, config, systemDark]);

  const storageKey = `feedock:${projectSlug}:visitor`;
  const [identity, setIdentityState] = useState<VisitorIdentity | null>(null);

  // Persist a verified session (state + localStorage) — shared by the SSO
  // auto-identify effect, `setIdentity`, and any future write.
  const persist = useCallback(
    (next: VisitorIdentity) => {
      setIdentityState(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // non-persistent session is acceptable
      }
    },
    [storageKey],
  );

  // Load any persisted visitor token on mount (client-only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      // Shape-check before trusting it: a corrupt/foreign value (e.g. `{}`) would
      // otherwise make `isVerified` true while `token` is undefined, so every
      // write sends `Bearer undefined` and fails with no self-heal. A bad value
      // is dropped so the visitor just re-verifies.
      if (isVisitorIdentity(parsed)) {
        setIdentityState(parsed);
      } else if (raw) {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore storage/parse errors — visitor just re-verifies
    }
  }, [storageKey]);

  // Identified-user (SSO): recognize an already-authenticated host user with no
  // email. A token is resolved by precedence — an explicit `userToken`, else the
  // lazy `getUserToken()` resolver (e.g. a fetch to the host's own identify
  // route) — and exchanged for a verified-visitor session. The host is
  // authoritative, so this overrides any stored anonymous identity; a
  // bad/expired/absent token silently falls back to the magic-link flow.
  //
  // `getUserToken` is read through a ref so an unstable inline prop doesn't
  // re-run the resolve on every render — it runs once per mount (or when an
  // explicit `userToken` changes). The in-flight promise is kept in a ref so a
  // write-gate can await it via `ensureIdentity()` and never flash the email
  // prompt at a signed-in user who clicked before the resolve landed.
  const getUserTokenRef = useRef(getUserToken);
  getUserTokenRef.current = getUserToken;
  const resolveRef = useRef<Promise<VisitorIdentity | null> | null>(null);

  useEffect(() => {
    let active = true;
    const run = (async (): Promise<VisitorIdentity | null> => {
      // Reuse an already-stored, still-valid visitor session instead of exchanging
      // again — the exchange is an API round-trip + a Requester DB write, and
      // without this it re-runs on EVERY mount/page-view (write amplification that
      // also pumps the SSO rate limit). Skip when the host asserts no specific user
      // (getUserToken path) or asserts the SAME user the stored session is for; an
      // explicit userToken for a DIFFERENT user still re-identifies (user switch).
      let stored: VisitorIdentity | null = null;
      try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (isVisitorIdentity(parsed)) {
          stored = parsed;
        }
      } catch {
        stored = null;
      }
      if (stored && isVisitorTokenFresh(stored.token)) {
        const asserted = userToken ? ssoTokenEmail(userToken) : null;
        if (!userToken || asserted === stored.email.toLowerCase()) {
          if (active) {
            setIdentityState(stored);
          }
          return stored;
        }
      }

      let token: string | null = userToken ?? null;
      if (!token && getUserTokenRef.current) {
        try {
          token = await getUserTokenRef.current();
        } catch {
          token = null;
        }
      }
      if (!token) {
        return null;
      }
      try {
        const r = await client.exchangeSso(token);
        const next = { token: r.token, email: r.email };
        if (active) {
          persist(next);
        }
        return next;
      } catch (err: unknown) {
        if (active) {
          // Surface a bad/expired token to the host developer instead of a
          // silent fall-through — they're likely signing/serving it wrong. The
          // visitor still falls back to the magic-link flow on their next write.
          const message = err instanceof Error ? err.message : String(err);
          console.warn(
            `[feedock] SSO token exchange failed (${message}). The visitor will fall back to email verification. Check the token your backend signs with the project's SSO secret.`,
          );
        }
        return null;
      }
    })();
    resolveRef.current = run;
    return () => {
      active = false;
    };
  }, [userToken, client, persist, storageKey]);

  // Cross-surface link handoff (Slice 2): when the host lists its board origin(s),
  // auto-append a FRESH single-use identity token to plain left-clicks navigating
  // there, so a signed-in user who follows a link from the app arrives on the board
  // already recognized. Opt-in + bounded to the configured origins; a modified
  // click (new tab), a foreign origin, or a token-fetch failure falls through
  // undecorated → the visitor just uses the normal email flow. Delegated on the
  // document (capture) so it covers ANY of the host's links, not only SDK-rendered.
  const boardOriginsKey = (boardOrigins ?? []).join("|");
  useEffect(() => {
    if (typeof document === "undefined" || !boardOriginsKey) {
      return undefined;
    }
    const origins = new Set(boardOriginsKey.split("|"));
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self")) {
        return; // no anchor, or opens a new tab/window (can't async-decorate)
      }
      let dest: URL;
      try {
        dest = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (
        !origins.has(dest.origin) ||
        dest.searchParams.has(SSO_HANDOFF_PARAM)
      ) {
        return;
      }
      // A board-bound plain left-click: intercept, mint a fresh token, navigate.
      event.preventDefault();
      void (async () => {
        let token: string | null = userToken ?? null;
        if (!token && getUserTokenRef.current) {
          try {
            token = await getUserTokenRef.current();
          } catch {
            token = null;
          }
        }
        if (token) {
          dest.searchParams.set(SSO_HANDOFF_PARAM, token);
        }
        window.location.assign(dest.href);
      })();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [boardOriginsKey, userToken]);

  // Resolve identity without prompting: current session, else the in-flight
  // auto-identify, else null. Reads `identity` live via a ref so a caller that
  // awaits it always sees the latest session (not a stale closure).
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const ensureIdentity =
    useCallback(async (): Promise<VisitorIdentity | null> => {
      if (identityRef.current) {
        return identityRef.current;
      }
      if (resolveRef.current) {
        return await resolveRef.current;
      }
      return null;
    }, []);

  const value = useMemo<FeedockContextValue>(
    () => ({
      client,
      slug: projectSlug,
      theme: resolved,
      config,
      identity,
      setIdentity: persist,
      clearIdentity() {
        setIdentityState(null);
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
      },
      ensureIdentity,
    }),
    [
      client,
      projectSlug,
      resolved,
      config,
      identity,
      storageKey,
      persist,
      ensureIdentity,
    ],
  );

  return (
    <FeedockContext.Provider value={value}>{children}</FeedockContext.Provider>
  );
}

/** Access the Feedock context; throws if used outside <FeedockProvider>. */
export function useFeedockContext(): FeedockContextValue {
  const ctx = useContext(FeedockContext);
  if (!ctx) {
    throw new Error(
      "Feedock components must be used inside <FeedockProvider>.",
    );
  }
  return ctx;
}
