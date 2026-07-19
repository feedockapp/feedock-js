import { signIdentity, type IdentityClaims } from "./sign.js";

const ERR = "[@feedock/sso]";

/** Per-user token — never let a cache or CDN hold on to it. */
const NO_STORE = { "cache-control": "no-store" } as const;

export interface IdentifyHandlerOptions {
  /** Your project's SSO secret (server-side only). */
  secret: string;
  /**
   * Resolve the signed-in user for THIS request from your own session — return
   * `null` when nobody is signed in. The email must come from your verified
   * session, never from user input: whatever you return here is what Feedock
   * trusts.
   */
  getUser: (
    request: Request,
  ) =>
    | Promise<IdentityClaims | null | undefined>
    | IdentityClaims
    | null
    | undefined;
  /** Token lifetime in seconds (see {@link signIdentity}). */
  ttlSeconds?: number;
}

/**
 * Build the "identify" route the widget/SDK calls to learn who the current
 * visitor is — the zero-touch path, so you never thread a token through render.
 *
 * Returns a framework-neutral `(Request) => Response` handler, so it drops into
 * anything with the Web Fetch API (Next.js App Router, Remix, Hono, Bun, Deno,
 * Cloudflare Workers). Signed out → `204` and the visitor stays anonymous
 * (they can still verify by email); signed in → `{ userToken }`.
 *
 * Mount it on YOUR OWN origin so the browser sends your session cookie, then
 * point `data-identify-endpoint` (widget) or `getUserToken` (React SDK) at it.
 *
 * @example
 * // Next.js App Router — app/feedock/identify/route.ts
 * export const dynamic = "force-dynamic";
 * export const GET = createIdentifyHandler({
 *   secret: process.env.FEEDOCK_SSO_SECRET!,
 *   getUser: async () => {
 *     const user = await getSession();
 *     return user ? { email: user.email, name: user.name, sub: user.id } : null;
 *   },
 * });
 */
export function createIdentifyHandler(
  options: IdentifyHandlerOptions,
): (request: Request) => Promise<Response> {
  const { secret, getUser, ttlSeconds } = options ?? {};
  // Fail at wiring time, not on the first request in production.
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new Error(
      `${ERR} createIdentifyHandler: 'secret' is required (your project's SSO secret).`,
    );
  }
  if (typeof getUser !== "function") {
    throw new Error(
      `${ERR} createIdentifyHandler: 'getUser' must be a function returning the signed-in user or null.`,
    );
  }

  return async function identify(request: Request): Promise<Response> {
    const user = await getUser(request);
    if (!user) {
      return new Response(null, { status: 204, headers: { ...NO_STORE } });
    }
    const userToken = await signIdentity(secret, user, { ttlSeconds });
    return new Response(JSON.stringify({ userToken }), {
      status: 200,
      headers: { "content-type": "application/json", ...NO_STORE },
    });
  };
}
