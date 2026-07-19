import { SignJWT } from "jose";

import {
  DEFAULT_TOKEN_TTL_SECONDS,
  MAX_TOKEN_TTL_SECONDS,
} from "./constants.js";

/** Who the host is vouching for. Only `email` is required. */
export interface IdentityClaims {
  /** The signed-in user's email. Feedock trusts this because YOU signed it. */
  email: string;
  /** Display name shown next to their posts and comments. */
  name?: string;
  /**
   * Your app's STABLE user id. Recommended: with it, identity is anchored on the
   * id rather than the email, so a user who changes their email keeps their
   * votes and comments instead of being orphaned under the old address.
   */
  sub?: string;
  /** Optional plan label, e.g. "Enterprise" — lets you sort feedback by revenue. */
  plan?: string;
  /** Optional monthly value in CENTS (non-negative integer), e.g. 299900 = $2,999. */
  monthlyValueCents?: number;
}

export interface SignIdentityOptions {
  /**
   * Seconds until the token expires. Defaults to {@link DEFAULT_TOKEN_TTL_SECONDS};
   * must be between 1 and {@link MAX_TOKEN_TTL_SECONDS} (the API refuses older).
   */
  ttlSeconds?: number;
}

const ERR = "[@feedock/sso]";

/**
 * A random single-use `jti`. `crypto.randomUUID` exists in Node 19+, Deno, Bun,
 * Workers and browsers; the byte fallback covers older Node 18 runtimes.
 */
function randomJti(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (typeof c?.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  c?.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sign a Feedock identity token on YOUR server, for the user of the current
 * request. Hand the result to the widget (`data-user-token`) or the React SDK
 * (`userToken` / `getUserToken`) and Feedock recognizes that user with no email
 * verification step.
 *
 * Produces exactly what the API expects — HS256, `iat`, a unique single-use
 * `jti`, and a short `exp` — so you don't have to reproduce the claim contract
 * by hand. Invalid input throws HERE, with a readable message, instead of
 * becoming an opaque 401 at exchange time.
 *
 * The secret is your project's SSO secret (Settings → Identified users (SSO)).
 * Keep it server-side only — never ship it to the browser.
 *
 * @example
 * const userToken = await signIdentity(process.env.FEEDOCK_SSO_SECRET!, {
 *   email: user.email,
 *   name: user.name,
 *   sub: user.id,
 * });
 */
export async function signIdentity(
  secret: string,
  claims: IdentityClaims,
  options: SignIdentityOptions = {},
): Promise<string> {
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new Error(
      `${ERR} signIdentity: a non-empty SSO secret is required (Settings → Identified users (SSO)).`,
    );
  }
  if (!claims || typeof claims !== "object") {
    throw new Error(`${ERR} signIdentity: claims object is required.`);
  }
  const email = typeof claims.email === "string" ? claims.email.trim() : "";
  if (email === "") {
    throw new Error(
      `${ERR} signIdentity: 'email' is required — Feedock rejects a token without it.`,
    );
  }
  const ttl = options.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_TOKEN_TTL_SECONDS) {
    throw new Error(
      `${ERR} signIdentity: ttlSeconds must be an integer between 1 and ${MAX_TOKEN_TTL_SECONDS} (got ${String(ttl)}). Feedock refuses tokens older than ${MAX_TOKEN_TTL_SECONDS}s.`,
    );
  }
  if (claims.monthlyValueCents !== undefined) {
    const v = claims.monthlyValueCents;
    if (!Number.isInteger(v) || v < 0) {
      throw new Error(
        `${ERR} signIdentity: monthlyValueCents must be a non-negative integer in CENTS (got ${String(v)}).`,
      );
    }
  }

  const payload: Record<string, unknown> = { email };
  if (typeof claims.name === "string" && claims.name.trim() !== "") {
    payload.name = claims.name.trim();
  }
  if (typeof claims.sub === "string" && claims.sub.trim() !== "") {
    payload.sub = claims.sub.trim();
  }
  if (typeof claims.plan === "string" && claims.plan.trim() !== "") {
    payload.plan = claims.plan.trim();
  }
  if (claims.monthlyValueCents !== undefined) {
    payload.monthlyValueCents = claims.monthlyValueCents;
  }

  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setJti(randomJti())
    .setExpirationTime(now + ttl)
    .sign(new TextEncoder().encode(secret));
}
