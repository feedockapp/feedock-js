# @feedock/react

## 0.9.0

### Minor Changes

- fa7e216: Let the host control the panel's typography. Every component styles itself with inline styles (required by the widget's Shadow DOM), which meant font sizes were hardcoded px a host could not reach — a stylesheet can't touch `style={{ fontSize: 14 }}`, and custom properties had nothing to act on.

  Sizes now resolve through `--feedock-font-size`, so one value scales the whole panel:

  ```css
  :root {
    --feedock-font-size: 16px;
    --feedock-font-family: "Inter var", system-ui, sans-serif;
  }
  ```

  Sizes are `calc()`-relative to that base rather than `em` (which compounds through nested rows) or `rem` (which resolves against the host's root and would leak their typography in). Unset, the defaults reproduce the previous pixel sizes exactly, so existing embeds and SDK consumers don't shift. `fs()` and the property names are exported for anyone composing their own UI.

### Patch Changes

- 1b13fc9: Soften the `<LatestUpdate>` toast shadow to a lighter two-layer lift (matching the widget launcher), instead of a single heavy drop.

## 0.8.2

### Patch Changes

- e5e22f8: Soften the `<LatestUpdate>` toast shadow to a lighter two-layer lift (matching the widget launcher), instead of a single heavy drop.

## 0.8.1

### Patch Changes

- 4420804: Comments now show the author's avatar, and posting one updates the count on the feedback card. Previously the card still read the old count after you commented, because only vote counts were fanned back to the list.
- 50291ac: Send a comment with ⌘/Ctrl+Enter. A bare Enter still adds a newline, so multi-line comments are unaffected.

## 0.8.0

### Minor Changes

- a153c3b: Cross-surface link handoff: a new `boardOrigins` prop on `<FeedockProvider>` (and `data-board-origins` on the widget). When set alongside `userToken`/`getUserToken`, the SDK auto-appends a fresh single-use identity token to plain left-clicks navigating to those origins — so a signed-in user who follows a link from your app onto your Feedock board arrives already recognized, no email prompt. Opt-in and bounded to the configured origins; modified clicks and token-fetch failures fall through undecorated.

### Patch Changes

- 45d93db: SSO auto-identify now reuses an already-valid stored visitor session instead of re-exchanging the host token on every mount. This cuts identity API calls (and the server-side write per exchange) from once-per-page-view to roughly once per token lifetime, and speeds up the identified experience. An explicit `userToken` for a **different** user still re-identifies (user switch), and a bad/expired token still falls back to the email flow.

## 0.7.1

### Patch Changes

- 9a63b9f: Colour code blocks in rendered rich-text bodies. Code arrives already
  highlighted from the public API (inert `hljs-*` token spans); the SDK now sets
  the token colours and code surface **inline** after render — in the provider's
  resolved light/dark mode — so it stays self-contained (no injected stylesheet)
  and ships **no** syntax-highlighter engine.

## 0.7.0

### Minor Changes

- 8b3fe7c: The public project config now carries `launcherIconOnly`, the founder's "show just the icon" launcher setting. Additive — existing consumers are unaffected.

## 0.6.0

### Minor Changes

- 0adac30: The feedback board and changelog now page through their full history. Both fetched only the first 20 items and dropped the rest — everything past page one was unreachable. They now show a "Load more" control that fetches and appends the next page, and hides itself at the end.

### Patch Changes

- 6755137: A batch of correctness and robustness fixes from a full review:

  - No longer crashes on a feedback status the SDK version doesn't recognize (falls back to Open), and a corrupt stored visitor identity is discarded instead of bricking every write.
  - Empty states share one gray and read honestly — a search with no matches no longer says "be the first to post", and a failed load doesn't read as an empty board.
  - Dismissing the "what's new" toast clears the unread badge across tabs; the update list and `/feedback` are each fetched once on open.
  - Token-gated writes reject their promise when unverified instead of throwing; the comment count, similar-suggestion staleness, avatar retry, and attachment keys are all fixed; button text on a light brand color is now readable; large files show GB; `&nbsp;` no longer shows literally in update excerpts. `FeedockContextValue` is now exported.

## 0.5.1

### Patch Changes

- c018979: Dismissing the "what's new" toast now clears the launcher's unread dot. The two read the same last-seen key, but the badge only checked it on mount — so dismissing an update left the dot claiming it was still unread until something remounted the widget.
- 4906875: Read surfaces now share one fetch hook. Two of them (the "what's new" toast and the launcher's unread dot) used to swallow fetch errors entirely, so a failed load left no trace; all read hooks now handle loading and errors the same way, and none silently drop a failure. No public API change.

## 0.5.0

### Minor Changes

- 49617e2: Dates now follow the visitor's locale everywhere. The roadmap and home cards pinned `en-US`, so a visitor in Berlin read "Mar 3" on the roadmap and "3. März" in the changelog byline beside it. All four date formatters are now one, and it respects the reader's locale — so ship dates outside the US will render differently than before.

  A malformed date also renders as empty rather than "Invalid Date".

## 0.4.4

### Patch Changes

- d1695af: Point "report a bug" at the board's own domain, feedback.feedock.com.

  Our public board moved to a dedicated custom domain. `bugs.url` and the README
  links now go there instead of to the /p/feedock path on the marketing site.

## 0.4.3

### Patch Changes

- de487e0: Fix inaccurate claims in the package READMEs and name the real npm scope.

  The MCP README said the server "only ever sees sanitized, public-safe data" — a PAT
  carries member permissions, so it reads private feedback, internal tasks, and
  unpublished drafts. It also described `confirm: true` as something the model cannot
  pass on its own; the model fills that argument in itself, and the client's approval
  prompt is what actually gates the call. Both now say what is true, and the README
  states that tool results leave your infrastructure for whichever model provider the
  client points at.

  The React README claimed inline styles mean "nothing leaks in from your CSS".
  Inline styles are not isolation: inherited properties, a global reset, and any
  `!important` rule still reach the components. It now says so, and points at the
  script widget's Shadow DOM for real isolation.

  Both CHANGELOGs still carried the abandoned `@feedockapp` scope, including a line
  telling readers to run `npx @feedockapp/mcp`, which 404s. The link guard now covers
  CHANGELOG.md, not just README.md — the hole the rename slipped through.

## 0.4.2

### Patch Changes

- 1a93a13: Point `repository` at the new public mirror.

  The packages' source now lives at github.com/feedockapp/feedock-js — public,
  MIT, mirrored from the private monorepo on release. An MCP server you hand a
  token to should be readable before you trust it, and an npm tarball should
  name a source you can open; `repository` was dropped last patch precisely
  because it could not.

## 0.4.1

### Patch Changes

- 3669b21: Point every package link somewhere a reader can actually open.

  The source repo is private, so `repository` and `bugs` sent people to
  github.com/feedockapp/feedock — npm renders both as buttons, and both 404'd
  for everyone. `bugs` now goes to feedock.com/p/feedock, our own public
  feedback board (the product's front door, and the thing we'd want a bug
  filed on anyway); `repository` is dropped, because there is no public source
  to name.

  `homepage` now deep-links the section of feedock.com/developers that
  documents each package (#react-sdk, #mcp-setup) instead of the site root.

- 1ad8668: Say what Feedock is on the npm page, and stop linking into a private repo.

  Both READMEs opened on how to use the package without answering what the
  service is — the npm page is where someone meets Feedock cold, often before
  the site. Each now leads with the loop in three lines and links feedock.com.

  The React README's "full guide" pointed at `../../docs/features/integration.md`:
  npm resolves relative links against the source repo, which is private, so it
  404'd for every reader. It points at feedock.com/developers, which is public
  and documents both packages.

## 0.4.0

### Minor Changes

- dfedc7e: Per-theme brand colors: the provider's brand cascade now distinguishes light
  and dark surfaces. New `FeedockTheme.brandColorDark` prop and
  `PublicProjectConfig.brandColorDark` field — on dark surfaces the accent
  resolves `brandColorDark ?? brandColor` at each cascade level (embed override
  → project setting → SDK default). `getConfig()` is also memoized per client
  instance so the provider and components share one request.

## 0.3.0

### Minor Changes

- dccbb9f: Theme now honors the project's Widget-appearance settings and the visitor's
  system preference. The provider resolves a cascade: an explicit `theme.mode`
  of `"light"`/`"dark"` wins; otherwise the project's saved theme setting
  (Light/Dark) applies; otherwise (setting Auto) the visitor's
  `prefers-color-scheme` decides — tracked live, so an OS theme switch restyles
  mounted components. `theme.mode` accepts `"auto"`, `brandColor` now defaults
  to the project's configured brand color, `ResolvedTheme` carries the resolved
  `mode`, and the public project config is exposed as `config` on the context.
  `getConfig()` is memoized per client instance.

  Behavior change: components with no `theme.mode` prop previously always
  rendered light; they now follow the project setting / system preference.
  Pass `theme={{ mode: "light" }}` to keep the old behavior.

## 0.2.0

### Minor Changes

- 9e75c42: Initial public release of the Feedock React SDK: `FeedockProvider`,
  `FeedbackBoard`, `Roadmap`, `Changelog`, the `useFeedock()` hook, and the
  `FeedockClient` — account-less, self-contained (no CSS setup), talking to the
  public Feedock API.

### Patch Changes

- 9e75c42: Refresh the default SDK theme to the Azure-blue palette: brighter accent (`#3E90F0`), near-black dark surfaces (bg `#101010`, card `#19191B`), cooler muted text, and updated per-status tones (Planned blue, In progress amber, Shipped green, Declined red). Founders can still override via `brandColor` / `data-brand-color`.
