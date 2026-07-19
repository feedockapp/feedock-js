/**
 * `@feedock/sso` — sign Feedock identity tokens on your backend so signed-in
 * users are recognized in the widget/SDK without an email verification step.
 *
 * Two entry points:
 *  - {@link signIdentity} — sign a token for one user (you own the transport).
 *  - {@link createIdentifyHandler} — a ready-made identify route for the
 *    zero-touch flow (`data-identify-endpoint` / `getUserToken`).
 *
 * Server-side only: it needs your project's SSO secret, which must never reach
 * the browser.
 */
export { signIdentity } from "./sign.js";
export type { IdentityClaims, SignIdentityOptions } from "./sign.js";
export { createIdentifyHandler } from "./handler.js";
export type { IdentifyHandlerOptions } from "./handler.js";
export {
  DEFAULT_TOKEN_TTL_SECONDS,
  MAX_TOKEN_TTL_SECONDS,
} from "./constants.js";
