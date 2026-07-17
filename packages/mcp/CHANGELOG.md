# @feedock/mcp

## 0.4.2

### Patch Changes

- badcdf2: `feedock_create_task` and `feedock_update_task` now accept `assigneeIds`
  (the whole assignee set, first = primary), `labelIds`, and `startDate` — the
  API's `CreateTaskInput`/`UpdateTaskInput` already supported them, but the tools
  only exposed a single `assigneeId` and `dueDate`. On update, an empty array
  clears assignees/labels and `null` clears `startDate`; omitted fields stay
  untouched. So an agent can now populate a task the way the dashboard shows it
  (multiple assignees, labels, a start–due range).

## 0.4.1

### Patch Changes

- 1aaef53: Convert markdown that a caller wrapped in a single `<p>…</p>`. A body pre-wrapped
  in one paragraph used to hit the HTML passthrough and land on the board as literal
  `##` headings and backticked code. `toRichTextHtml` now peels off a lone outer
  paragraph and converts the markdown inside. Genuine round-tripped HTML — inline
  tags in one paragraph, or multi-block bodies — is still passed through untouched.

## 0.4.0

### Minor Changes

- 4e0b570: Add `feedock_update_roadmap_item` — edit a roadmap item's title, description,
  visibility, target window, or linked milestone.

  The MCP could create a roadmap item and then never correct it: the API has
  `updateRoadmapItem`, the MCP never exposed it. Markdown in the description is
  converted like every other rich-text write.

  Editing an item that is (or becomes) PUBLIC needs `confirm:true`. The gate reads
  the item's current visibility rather than trusting the arguments, because an edit
  to live public copy is a public write even when the call says nothing about
  visibility. Lanes are deliberately not editable here — moving to Shipped emails
  requesters, and that gate stays in `feedock_move_roadmap_item`.

## 0.3.5

### Patch Changes

- d1695af: Point "report a bug" at the board's own domain, feedback.feedock.com.

  Our public board moved to a dedicated custom domain. `bugs.url` and the README
  links now go there instead of to the /p/feedock path on the marketing site.

- 6a793c4: Convert markdown to HTML when creating a roadmap item or an official feedback
  comment.

  Both forwarded the raw string, so a model writing markdown put literal `##` and
  backticks on the board. The other rich-text writes (tasks, docs, changelog)
  already converted; these two were missed. A sweep test now covers every
  rich-text write so the next one cannot skip it.

- 01aaf71: `feedock_overview` now names the project a project-bound token is working in.

  It reported `project: null` for bound tokens, because the identity came only from
  the in-process session that all-projects tokens get after `feedock_select_project`.
  Bound tokens are the case that most needs it: with a server configured per project,
  that field is the only thing telling an agent whose board it is about to write to.

  Needs an API that exposes `currentProject`; against an older one the overview still
  returns the full snapshot and leaves the project unnamed.

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
