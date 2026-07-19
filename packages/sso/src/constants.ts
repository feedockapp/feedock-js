/**
 * The token contract Feedock's API enforces at `POST /public/p/:slug/identity/sso`.
 *
 * These are mirrored here rather than imported: this package is published to npm
 * and cannot depend on the private API. Keep them in sync with
 * `SSO_MAX_TOKEN_AGE_SEC` in `apps/api/src/public/public.constants.ts` — the API
 * is the source of truth, and it rejects (401) anything outside these bounds.
 */

/**
 * Hard ceiling the API places on a token's age (measured from `iat`) when it is
 * exchanged. A token older than this is refused even if its `exp` is further out,
 * so the leaked-token replay window stays bounded.
 */
export const MAX_TOKEN_TTL_SECONDS = 600;

/**
 * Default lifetime. The SDK exchanges the token immediately on mount, so it needs
 * only seconds of validity — short is strictly safer, and well under the ceiling.
 */
export const DEFAULT_TOKEN_TTL_SECONDS = 120;
