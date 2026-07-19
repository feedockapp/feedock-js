# @feedock/sso

## 0.1.0

### Minor Changes

- 4640733: New package: sign Feedock identity tokens on your backend so signed-in users skip
  email verification in the widget and React SDK.

  - `signIdentity(secret, claims, opts?)` — signs an HS256 token to Feedock's exact
    contract (`iat`, a single-use `jti`, a short `exp` capped at 10 minutes) and
    throws a readable error locally on bad input instead of becoming an opaque 401.
  - `createIdentifyHandler({ secret, getUser })` — a ready-made identify route that
    returns `204` when signed out and `{ userToken }` when signed in. Framework
    neutral (`Request` → `Response`), so it works on Next.js, Remix, Hono, Bun, Deno
    and Cloudflare Workers.
