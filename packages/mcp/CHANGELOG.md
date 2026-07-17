# @feedock/mcp

## 0.3.4

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

## 0.3.3

### Patch Changes

- 1a93a13: Point `repository` at the new public mirror.

  The packages' source now lives at github.com/feedockapp/feedock-js — public,
  MIT, mirrored from the private monorepo on release. An MCP server you hand a
  token to should be readable before you trust it, and an npm tarball should
  name a source you can open; `repository` was dropped last patch precisely
  because it could not.

## 0.3.2

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

## 0.3.1

### Patch Changes

- 855ba65: Report the real version in the MCP handshake. It was a hand-maintained
  constant that Changesets never touched, so it still said 0.1.0 at package
  0.3.0 — the one thing you cannot have lie when someone asks a client which
  version it is running. Now injected from `package.json` at build time.

## 0.3.0

### Minor Changes

- bc6d61b: Task + doc write tools, multi-project connections, and markdown bodies.

  - `feedock_update_task` / `feedock_delete_task` and `feedock_create_doc` /
    `feedock_update_doc` / `feedock_delete_doc` — tasks could only be created and
    moved, and docs were read-only. Deletes and public-doc writes require an
    explicit `confirm: true`.
  - `feedock_list_projects` / `feedock_select_project` — an all-projects token
    now spans every board from one connection, with membership re-checked per
    call; a project can opt out of MCP entirely.
  - Bodies are markdown in, rich text out. Models write markdown but every
    Feedock surface stores HTML, so tool-written tickets rendered as literal
    `##` and backticks; write tools now convert (and the tool descriptions say
    so, which is where a model learns to format).
  - `feedock_overview` reports which project its numbers describe.

## 0.2.0

### Minor Changes

- aee2c0f: Add an optional `wrapTool` hook to `createServer` (and export the `ToolHandler`
  type). It wraps every tool's handler as it registers, so an embedder can enforce
  per-tool policy — the remote OAuth server uses it to gate each tool by the
  connection's granted scope. The stdio path leaves it unset (unchanged behaviour).

### Patch Changes

- aee2c0f: Make the MCP server self-contained and publishable. The publish build now bundles
  the workspace `@feedock/sanitize` into `dist/` via esbuild (real npm deps stay
  external), emits a `.d.ts` tree with tsc, and drops `private` — so `npx
@feedock/mcp` resolves with no `workspace:*` runtime dependency.
