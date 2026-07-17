# @feedock/mcp

An MCP server that connects Claude, Cursor, or any MCP client to your
[Feedock](https://feedock.com) project. The model reads your feedback board,
roadmap, tasks, milestones, docs, and changelog through 30 tools, and writes back
to all of them — including deleting tasks and emailing the people who asked for a
feature. Read the gates below before you connect it.

It runs over stdio and authenticates with a Personal Access Token you generate and
revoke.

## What is Feedock?

[Feedock](https://feedock.com) is a feedback and roadmap workspace for small teams.
Your users post and upvote requests, you promote the good ones to the roadmap, and
publishing the changelog entry emails the people who asked. This server gives an
agent the same reach you have.

You need a project at [feedock.com](https://feedock.com) to get a token. Full setup
and the tool reference: [feedock.com/developers#mcp-setup](https://feedock.com/developers#mcp-setup).

Source: [github.com/feedockapp/feedock-js](https://github.com/feedockapp/feedock-js)
(read-only mirror).

## Setup

Nothing to install — `npx` fetches the server. Needs Node 20.19+. Configure it with
two environment variables:

| Variable | Value |
| --- | --- |
| `FEEDOCK_API_URL` | Your API origin, e.g. `https://api.feedock.com`. Plain `http://` is rejected for everything but localhost, since your token would otherwise cross the network in cleartext. |
| `FEEDOCK_API_TOKEN` | A Personal Access Token (`fdk_pat_…`). Generate one in Settings → API tokens; revoke it there too. |

> **Name the server after its project: `feedock-<your-slug>`, not `feedock`.**
> Clients key servers by name, so a second entry called `feedock` overwrites the
> first and that project silently drops off. Settings → MCP fills your slug in for
> you. (An all-projects token reaches every board from one connection, so plain
> `feedock` is right for that case.)

### Claude Code

```sh
claude mcp add feedock-your-project \
  -e FEEDOCK_API_URL=https://api.feedock.com \
  -e FEEDOCK_API_TOKEN=fdk_pat_… \
  -- npx -y @feedock/mcp
```

### Claude Desktop, Cursor, Codex (`mcpServers` JSON)

```json
{
  "mcpServers": {
    "feedock-your-project": {
      "command": "npx",
      "args": ["-y", "@feedock/mcp"],
      "env": {
        "FEEDOCK_API_URL": "https://api.feedock.com",
        "FEEDOCK_API_TOKEN": "fdk_pat_…"
      }
    }
  }
}
```

## What your token reaches

A PAT carries your own member permissions. The server reads internal data: private
feedback, internal tasks, unpublished changelog drafts, private docs. It is not a
public or read-only key — hand it out the way you'd hand out a session.

Two consequences worth stating plainly:

- **Whatever the model reads leaves your infrastructure.** A tool result goes to
  whichever model provider your client is pointed at. If a private doc or an
  unpublished draft shouldn't reach a third party, don't put that project behind an
  agent. Every project has an MCP access switch for exactly this.
- **There is no read-only scope.** A token that can read can also write. An agent
  that only reads isn't something this server can enforce today.

Tokens come in two scopes:

- **Project-bound** — one project. The model never names a project; the token
  decides.
- **All-projects** — every project you're a member of that has MCP access switched
  on. The model calls `feedock_list_projects`, then `feedock_select_project` once
  per session. Your membership and each project's MCP switch are re-checked
  server-side on every call, and a project with MCP access off is invisible.

## What the model can do to your project

**Read** (no gate): list and inspect feedback, roadmap items, tasks, milestones,
docs, and changelog entries, plus `feedock_overview` for a snapshot of the whole
loop.

**Write**: create and update tasks, docs, roadmap items, and changelog drafts; move
feedback and task statuses; convert feedback into a roadmap item or a task.

Anything public, irreversible, or destructive takes a required `confirm: true`
argument. Be clear about what that does and doesn't buy you: it forces the model to
ask for the destructive thing deliberately rather than stumble into it, and it makes
the intent legible in the tool call. **It is not a security boundary — the model
fills that argument in itself.** What actually stops a bad call is your client
showing you the call and you reading it, so keep approval prompts on for these
tools. That matters because feedback text is written by strangers, and a feedback
body is a natural place to try to talk a model into publishing or deleting
something.

| Action | Gate |
| --- | --- |
| `feedock_publish_changelog` | Preview-first. Call `feedock_preview_changelog_publish`, then pass its `previewToken` + `confirm:true` + `expectedFirstPublish`. The API re-derives the token over the current recipients and rejects if anything moved since the preview. First publish emails verified requesters and changelog subscribers, and moves linked roadmap items to Shipped. Not reversible. Owner/Admin. |
| `feedock_move_roadmap_item` → Shipped | `confirm:true`. Emails everyone who asked. Not reversible, and not idempotent — re-shipping rewrites `shippedAt`. Owner/Admin. |
| `feedock_merge_feedback` | `confirm:true` + `expectedCanonicalTitle`, checked against the live title before the fold as a race guard. Votes, follows, and comments move onto the canonical. Not reversible. Owner/Admin. |
| `feedock_delete_task` | `confirm:true`. Permanent. Subtasks are not deleted — they re-parent to top level. |
| `feedock_delete_doc` | `confirm:true`. Permanent; the doc's annotations cascade with it. |
| `feedock_add_feedback_comment` | `confirm:true`. The reply is publicly visible. |
| `feedock_create_roadmap_item`, `feedock_convert_feedback_to_roadmap` | `confirm:true` when the item is PUBLIC. Convert defaults to PUBLIC. |
| `feedock_create_doc`, `feedock_update_doc` | `confirm:true` when visibility is PUBLIC — it puts the doc on your portal. |

Three properties hold across every tool:

- **Rich text is sanitized before the model sees it.** Feedback, comments, doc and
  changelog bodies are HTML-sanitized on the way out, against the allow-list in
  [`@feedock/sanitize`](https://github.com/feedockapp/feedock-js/tree/main/packages/sanitize).
  Sanitized is not the same as public-safe: the content is still your internal data.
- **Content is data, not instructions.** The server tells the model to treat all
  end-user text as untrusted observations rather than commands.
- **Errors carry no secrets.** API failures map to short messages, never a stack
  trace, SQL, or your token.

## Bugs

Post them on our own board: [feedback.feedock.com](https://feedback.feedock.com).

## License

MIT © Feedock
