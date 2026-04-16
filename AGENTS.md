# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## What this is

Agentsyncboard is a job board and coordination layer for AI agents. Agents use the `agentboard` CLI to claim jobs, post progress, request human input, and hand off work. The web UI lets the human monitor agent activity, review diffs, approve jobs, and answer input requests in real time.

## Commands

All commands run from the repo root. The project uses **Bun** throughout — no Node/npm.

```bash
# Start both server and client in dev mode
bun run dev

# Server only (hot reload)
cd server && bun run dev

# Client only
cd client && bun run dev

# Build server for production
bun run build

# Run CLI
bun run agentboard <command>
# or after install: agentboard <command>

# Run server tests
cd server && bun test

# Run a single test file
cd server && bun test src/pollRegistry.test.ts
```

Server runs on `:31377`. Client dev server on `:5173` and proxies `/api` and `/ws` to the server.

## Architecture

### Three parts

**`server/`** — Elysia (Bun) HTTP + WebSocket server. SQLite via Drizzle ORM. No migrations framework — schema is applied in `src/db/index.ts:initDb()`, which also handles inline migrations for schema changes. All routes are under `/api`, grouped in `src/routes/`. The DB file lives at `data/agentsyncboard.db`.

**`client/`** — React 19 + Vite + Tailwind v4. TanStack Query v5 for server state. Zustand for UI state (`src/store/index.ts`). All API calls go through the `api` export in `src/api/client.ts` — never use bare `fetch` or `requestJson` for server calls. Wrap every call with `unwrap()` from the same file, which throws on error.

**`scripts/agentboard/`** — CLI that agents run. Each command group is a file in `commands/`. Uses plain `fetch` against the server. Entry point is `scripts/agentboard/index.ts`.

### Real-time flow

WebSocket at `/ws` carries all state change events. `wsManager.ts` holds connected clients and broadcasts. The client's `useWebSocket` hook receives events and invalidates TanStack Query caches — this is the primary way the UI stays live. Events follow the pattern `entity:action` (e.g. `job:updated`, `input:created`, `build:completed`).

### Long-poll vs polling

The `pollRegistry` (`server/src/pollRegistry.ts`) parks a Promise in memory keyed by a string, resolved when an action completes (e.g. a human answers an input request or approves a job). **Only used server-side for the `await-review` endpoint.** The CLI does not use long-poll — it polls short `GET` requests every 3s to avoid HTTP connection timeouts.

### Git worktrees

Impl jobs get a git worktree created under `<repo-path>/../.git-worktrees/<branch-name>`. All worktree operations are in `server/src/git.ts`. The worktree path is returned on `job claim` and is the only place an impl agent should write files.

### DB schema migrations

There is no migration runner. `initDb()` in `server/src/db/index.ts` creates tables with `CREATE TABLE IF NOT EXISTS`. For additive changes (new nullable columns), use `ALTER TABLE ... ADD COLUMN`. For enum changes or structural changes, the pattern is to rebuild the table (see `rebuildJobsTable` as an example).

### Client API pattern

`src/api/client.ts` exports a manually-typed `ApiClient` interface cast over an Eden treaty instance. Eden's automatic type inference does not work here — Elysia's `~Routes` type produces generic string keys rather than route-specific literals, likely due to the `.onError()` / `.ws()` middleware chain in `app.ts` widening the type. The `ApiClient` interface in `client.ts` is the source of truth for the client-visible API shape.

When adding a new endpoint:

1. Add the route handler to the relevant file in `server/src/routes/`
2. Add the method signature to `ApiClient` in `client/src/api/client.ts`
3. Broadcast via `wsManager.broadcast(event, data)` if clients need to react
4. Add a `queryKeys` entry in `client/src/api/keys.ts` if the client will query it
5. Invalidate the query key in `useWebSocket.ts` when the corresponding WS event arrives

Usage pattern in components:
```ts
const data = await unwrap(api.jobs.get())
const job  = await unwrap(api.jobs({ id }).get())
await unwrap(api.jobs({ id }).patch({ status: 'done' }))
```

### Agent definitions and mandates

`docs/agent-definitions/` contains markdown agent definition files (`ORCHESTRATOR-agentboard.md`, `WORKER-agentboard.md`) intended to be copied to a work PC and loaded into an AI coding agent. `docs/mandates/` contains per-job-type operating instructions that are injected into `agentboard job context` output at runtime via the `job_type_mandates` table. Edit mandates here; they're referenced by file path in the DB.
