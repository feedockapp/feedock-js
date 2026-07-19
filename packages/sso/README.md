# @feedock/sso

Sign Feedock identity tokens on your backend so users who are already signed in
to **your** app are recognized in the Feedock widget and React SDK — no "confirm
your email" step.

Feedock end users stay account-less: by default they verify with a one-time magic
link. When Feedock runs inside your own authenticated app that's needless
friction, and trusting an email from the browser would be spoofable. So identity
is **host-signed**: your server signs a short-lived JWT with your project's SSO
secret, and Feedock verifies it.

This package is that signing step, done correctly — so you don't reproduce the
claim contract by hand and discover a mistake as an opaque `401`.

```sh
npm install @feedock/sso
```

## The 3-line version

Mount an identify route on **your own origin** and point the widget at it:

```ts
// Next.js App Router — app/feedock/identify/route.ts
import { createIdentifyHandler } from "@feedock/sso";

export const dynamic = "force-dynamic"; // per-user, never cached

export const GET = createIdentifyHandler({
  secret: process.env.FEEDOCK_SSO_SECRET!,
  getUser: async () => {
    const user = await getSession(); // your session
    return user ? { email: user.email, name: user.name, sub: user.id } : null;
  },
});
```

```html
<script
  src="https://cdn.feedock.com/widget.js"
  data-project="your-project"
  data-identify-endpoint="/feedock/identify"
  async
></script>
```

That's it. Signed-in visitors are recognized automatically; signed-out ones fall
back to the normal email flow.

The handler returns a standard `Response`, so it works on any Fetch-API runtime —
Next.js, Remix, Hono, Bun, Deno, Cloudflare Workers.

## React SDK

```tsx
<FeedockProvider
  projectSlug="your-project"
  getUserToken={async () => {
    const r = await fetch("/feedock/identify");
    return r.ok ? (await r.json()).userToken : null;
  }}
>
```

## Signing a token yourself

If you'd rather own the transport (server-rendered token, custom framework):

```ts
import { signIdentity } from "@feedock/sso";

const userToken = await signIdentity(process.env.FEEDOCK_SSO_SECRET!, {
  email: user.email,
  name: user.name,
  sub: user.id,
});
```

Then pass it as `data-user-token` (widget) or `userToken` (SDK).

## Claims

| Claim               | Type    | Required | Notes                                                                                                                               |
| ------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `email`             | string  | **yes**  | The identity Feedock trusts. Take it from your verified session, never from user input.                                             |
| `name`              | string  | no       | Display name on their posts and comments.                                                                                           |
| `sub`               | string  | no       | **Recommended.** Your stable user id. Anchors identity on the id, so a user who changes their email keeps their votes and comments. |
| `plan`              | string  | no       | Plan label, e.g. `"Enterprise"` — lets you sort feedback by revenue.                                                                |
| `monthlyValueCents` | integer | no       | Their monthly value in **cents** (`299900` = $2,999/mo).                                                                            |

`iat`, a unique single-use `jti`, and a short `exp` are set for you.

## Getting your secret

Dashboard → **Settings → Identified users (SSO)** → generate. It's shown once.

Keep it on your **server only** — never ship it to the browser. Rotating it gives
you a new secret while the old one keeps working for a 24-hour grace window, so
logins don't break between rotating and redeploying.

## Notes

- **Token lifetime** defaults to 2 minutes and is capped at 10 minutes: Feedock
  rejects a token older than that regardless of its `exp`, which bounds the
  replay window if one ever leaks. Bad input (missing email, out-of-range TTL)
  throws immediately with a readable message rather than failing at exchange.
- **Single-use**: each token carries a `jti` and Feedock refuses a second
  exchange of the same one.
- **Wrong secret ⇒ 401.** From the UI that looks identical to "not configured"
  (both end at the email prompt), so check the network tab: `identify` should
  return `200`, then `identity/sso` should return `2xx`.

Full guide: <https://feedock.com/developers#identity>

MIT © Feedock
