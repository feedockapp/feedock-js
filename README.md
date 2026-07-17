# Feedock — public packages

The source for the packages [Feedock](https://feedock.com) publishes to npm.

> **This is a read-only mirror.** These packages are developed in Feedock's main
> repository, which is private, and synced here on release. **Pull requests here
> cannot be merged** — the next sync overwrites them. Please post issues and
> requests on [feedock.com/p/feedock](https://feedock.com/p/feedock) instead.

| Package | npm | What it is |
|---|---|---|
| [`@feedock/react`](packages/react) | [![npm](https://img.shields.io/npm/v/@feedock/react)](https://www.npmjs.com/package/@feedock/react) | React components that put a feedback board, roadmap, and changelog in your app |
| [`@feedock/mcp`](packages/mcp) | [![npm](https://img.shields.io/npm/v/@feedock/mcp)](https://www.npmjs.com/package/@feedock/mcp) | MCP server — drives your Feedock project from Claude, Cursor, or any MCP client |
| [`@feedock/sanitize`](packages/sanitize) | — (not published) | The HTML allow-list the API sanitizes with. Published here to be read, not installed. |

```sh
npm install @feedock/react     # embed the board in your React app
npx -y @feedock/mcp            # run the MCP server (needs a token)
```

Both need a project at [feedock.com](https://feedock.com) to talk to — they are
clients for the hosted service, not a self-hostable backend. Setup for each is in
its own README, and the full guide is at
[feedock.com/developers](https://feedock.com/developers).

## What is Feedock?

[Feedock](https://feedock.com) is a feedback and roadmap workspace for small teams.
Your users post and upvote requests, you promote the good ones to the roadmap, and
publishing the changelog entry emails the people who asked for it.

## Why the code is public

`@feedock/mcp` asks you to hand an AI agent a token that can read and write your
project — including private feedback and unpublished drafts. `@feedock/react` runs
in your users' browsers. Neither is something you should take on our word, so the
code is here: the tool definitions, what each one sends, which actions are gated,
and the allow-list the API sanitizes with.

One thing worth being straight about, since it's the obvious hole in that argument:
`@feedock/react` does not sanitize anything itself. It renders HTML the API already
sanitized. So for that package the boundary you're trusting is our server, not this
code — which is exactly why [`@feedock/sanitize`](packages/sanitize), the allow-list
that server applies, is mirrored here even though it isn't published to npm.

## Reporting a security issue

Email **support@feedock.com** with "security" in the subject, rather than opening an
issue here — an issue is public before we can fix it. Please don't test against
other people's projects; a free project of your own is a fine target.

## License

MIT — see [LICENSE](LICENSE). Use them freely, including in commercial products.
