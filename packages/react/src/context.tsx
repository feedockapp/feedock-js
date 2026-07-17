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

interface FeedockContextValue {
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
  }, [userToken, client, persist]);

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
