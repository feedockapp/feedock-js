# @feedock/react

Embed a Feedock feedback board, roadmap, and changelog in your React app. Visitors
vote and post without creating an account — they verify an email once per browser,
or you skip that entirely with a signed token from your backend.

Feedock is a feedback and roadmap workspace for small teams: users post and upvote
requests, you promote the good ones to the roadmap, and publishing the changelog
entry emails the people who asked for it. This package renders the public side of a
Feedock project inside your own app instead of on a hosted portal. You need a
project at [feedock.com](https://feedock.com) — `projectSlug` below is its handle.

To see what these components look like before installing, our own board runs on
Feedock: [feedback.feedock.com](https://feedback.feedock.com).

## Install

```bash
npm install @feedock/react
```

React 18 or 19 is a peer dependency. Nothing else — the package has no runtime
dependencies.

## Quick start

```tsx
import { FeedockProvider, FeedbackBoard } from "@feedock/react";

export function Feedback() {
  return (
    <FeedockProvider projectSlug="acme">
      <FeedbackBoard />
    </FeedockProvider>
  );
}
```

That's the whole setup. Colors come from your project's Widget appearance settings;
override them per embed with `theme`.

There is no stylesheet to import — components carry inline styles. Worth being
precise about what that does and doesn't mean, because inline styles are not
isolation: your CSS classes won't restyle these components, but inheritable
properties like `font-family`, `line-height`, and `color` still come from your page,
a global reset like `* { box-sizing: border-box }` still applies, and an
`!important` rule in your stylesheet still wins. In practice inheriting your type
is usually what you want, since the board looks like your app. If you need real
isolation, the script widget renders into a Shadow DOM instead.

## Components

Wrap anything below in a single `<FeedockProvider>`.

| Component | Renders | Writes |
|---|---|---|
| `<FeedbackBoard />` | Searchable public feedback, Top/New sort, detail view with comments | vote, post, comment, follow, attach |
| `<Roadmap />` | Now / Next / Later / Shipped, with "X people asked" and milestone progress | — |
| `<Changelog />` | Published updates, newest first | — |
| `<LatestUpdate />` | Dismissible toast for the newest update this visitor hasn't seen | — |
| `<Composer />` | Standalone post form; calls `onPosted(item)` | post, attach |
| `<Home />` | Trending / In progress / Updates summary. Requires `tabs: string[]` | — |
| `<Spinner />` | Loading spinner in the resolved theme | — |

`<FeedbackBoard>` takes `defaultSort` (`"top"` \| `"new"`, default `"top"`),
`showSubmit` (default `true`), and `fill` (default `false` — set it to scroll only
the list inside a fixed-height panel).

`<FeedbackBoard>`, `<Roadmap>`, and `<Changelog>` also accept host-control props for
panel embeds: `openItemId` + `openItemNonce` to deep-link a detail view,
`onDetailOpenChange`, `collapseNonce`, `hideDetailBack`, and `reloadKey` to force a
refetch.

## Provider props

| Prop | Type | Default | |
|---|---|---|---|
| `projectSlug` | `string` | required | Your project's public slug |
| `apiBase` | `string` | `https://api.feedock.com` | Point at a different API origin |
| `theme` | `FeedockTheme` | project settings | See below |
| `userToken` | `string` | — | Host-signed SSO token, exchanged on mount |
| `getUserToken` | `() => Promise<string \| null>` | — | Lazy resolver for the same token |

### Theming

```tsx
<FeedockProvider
  projectSlug="acme"
  theme={{ brandColor: "#3E90F0", brandColorDark: "#5AA9FF", mode: "auto" }}
>
```

`mode` is `"light"`, `"dark"`, or `"auto"`. Resolution order: an explicit `mode`
here wins, then your project's saved Widget appearance, then the visitor's
`prefers-color-scheme` (tracked live). `brandColorDark` applies on dark surfaces and
falls back to `brandColor`, then to your project's configured colors, then to
Feedock's default blue.

## Identity

### Magic link (the default)

1. A visitor clicks vote or post. The component shows an inline email prompt.
2. The API emails a single-use link, good for 15 minutes.
3. The visitor verifies. The SDK stores a project-scoped visitor token in
   `localStorage`, so this happens once per browser.
4. The held action runs. Votes dedupe per email.

In development the API returns the token directly, so local testing needs no inbox.

### SSO for users already signed into your app

Re-verifying email inside your own authenticated app is friction. Passing a plain
email would let anyone vote as anyone, so your backend signs the identity instead
and Feedock verifies the signature.

Generate the SSO secret under Settings (Owner/Admin) and keep it on your server.

```ts
// your backend
import { SignJWT } from "jose";

const token = await new SignJWT({ email: user.email, name: user.name })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.FEEDOCK_SSO_SECRET));
```

Hand it to the provider:

```tsx
<FeedockProvider projectSlug="acme" userToken={token}>
```

Or resolve it lazily, so a signed-in user is recognized without threading a token
through every render:

```tsx
const getUserToken = useCallback(async () => {
  const res = await fetch("/api/feedock/identify");
  return res.ok ? (await res.json()).token : null;
}, []);

<FeedockProvider projectSlug="acme" getUserToken={getUserToken}>
```

The SDK exchanges the token on mount and the visitor is never prompted. Keep
`getUserToken` memoized — it runs once per mount. An invalid or expired token logs a
warning and falls back to the magic link, so a signing mistake degrades instead of
blocking writes.

Optional `plan` and `monthlyValueCents` claims let Feedock roll up the revenue
behind each request, so the board can sort by what paying customers want. See the
[docs](https://feedock.com/developers#react-sdk).

## Hooks and client

`useFeedock()` backs the bundled components; reach for it when you want your own
markup.

```tsx
const { isVerified, vote, submit } = useFeedock();
```

It returns `identity`, `isVerified`, `ensureIdentity`, `startIdentity`, `verify`,
`identify`, `signOut`, `vote`, `setFollow`, `similar`, `submit`, `uploadAttachment`,
`comment`, and `subscribe`. Call `ensureIdentity()` before showing your own email
prompt — it resolves an in-flight SSO exchange so a signed-in user never sees one.

`useUnreadUpdate()` reports whether there's a published update this visitor hasn't
seen, for badging your own launcher.

`FeedockClient` is a plain class with no React dependency. Reads need no token:

```ts
import { FeedockClient } from "@feedock/react";

const client = new FeedockClient("https://api.feedock.com", "acme");
const page = await client.listFeedback({ sort: "top" });
```

## Next.js and server rendering

Every component ships with `"use client"`, so the App Router draws the boundary for
you — importing them from a server component works without a wrapper. They fetch in
the browser, so the first paint is a loading state. If you want public feedback
server-rendered and indexable, use the hosted portal instead of this package.

## What's exposed

- Reads return public data only. The boundary is enforced server-side at the read
  model, so internal notes, emails, tasks, and drafts cannot cross it.
- Writes require a verified visitor token and are rate-limited per email and per IP.
- Rich text is sanitized server-side, against the allow-list in
  [`@feedock/sanitize`](https://github.com/feedockapp/feedock-js/tree/main/packages/sanitize),
  before it reaches the SDK. This package renders that HTML as-is rather than
  sanitizing again, so the server is the boundary you're trusting — the allow-list
  is published so you can read it.
- The public API accepts cross-origin requests by design, so the SDK works from any
  host. Dashboard data is behind separate auth and isn't reachable from the browser.

## Links

- Docs: [feedock.com/developers#react-sdk](https://feedock.com/developers#react-sdk)
- Source (read-only mirror): [github.com/feedockapp/feedock-js](https://github.com/feedockapp/feedock-js)
- Feedback and bugs: [feedback.feedock.com](https://feedback.feedock.com)

MIT
