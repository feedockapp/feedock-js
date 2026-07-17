# `@feedock/mcp` evaluation scenarios

Read-only, independent, verifiable Q&A used to evaluate the stdio MCP server,
per [`docs/features/mcp-server.md` §8](../../../docs/features/mcp-server.md)
(Phase-1 evals / mcp-builder Phase 4). This directory is the **future Inspector
run** fixture — it does **not** need a live API to author, and is intentionally
checked in so the eval set is reviewable and stable.

## What's here

- [`scenarios.json`](./scenarios.json) — the machine-readable scenario set: each
  entry is the question, the loop stage it covers, the tools it forces, why it is
  multi-hop, and the `expectedAnswerContains` string-match assertions. The
  `<seed: …>` placeholders are filled from the **seeded project** the run targets
  (the `packages/db` seed fixture) — freezing them turns the file into a scored
  test.

## Design rules (why these six)

Every scenario is:

1. **Read-only** — no scenario mutates state, so a re-run is reproducible. Writes
   (`create_*`, `update_*`, `convert_*`, `move_*`) are deliberately **excluded**
   from evals; the friction tools (`feedock_publish_changelog`,
   `feedock_merge_feedback`) are covered by the unit tests
   (`src/schemas/friction.spec.ts`, `src/tools/friction-handlers.spec.ts`) plus a
   manual confirm-flow check, never by an automated eval.
2. **Multi-hop** — each forces several tool calls (e.g. resolve a task id from its
   number, then fetch its detail), so the model has to *sequence* the catalog, not
   answer from one shot. This is what stresses the tool descriptions + schemas.
3. **Stable / verifiable** — the answer will not drift on a frozen seed, and is
   scored by case-insensitive string match against `expectedAnswerContains`.

The six cover the whole loop: feedback triage, roadmap + "who asked", task ↔ git,
milestone progress, published changelog, and the `feedock_overview` composition
(including `atCap` / `mayBeTruncated` lower-bound awareness — the model must not
over-claim exactness on capped lists).

## How to run (when a seeded project + PAT exist)

```bash
# 1. Build the server
yarn workspace @feedock/mcp build

# 2. Seed a project (packages/db seed) and mint a PAT bound to it
#    (Settings → API tokens, or the seed script).

# 3. Drive each scenario through the stdio server via the MCP Inspector CLI,
#    with the PAT in the env (the server reads FEEDOCK_API_URL/FEEDOCK_API_TOKEN):
FEEDOCK_API_URL=https://api.feedock.com \
FEEDOCK_API_TOKEN=fdk_pat_… \
npx @modelcontextprotocol/inspector --cli node packages/mcp/dist/cli.js

# 4. For each scenario, pose `question`, let the model call tools, and score the
#    final answer: PASS if every string in `expectedAnswerContains` appears
#    (case-insensitive). Target ≥ 90% pass across the set.
```

> Note: a scored run needs a seeded project and a PAT. The scenarios are the
> reviewed contract on their own — authoring them needs no live API.
