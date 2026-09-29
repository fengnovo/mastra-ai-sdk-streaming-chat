# Background Chat Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat runs survive conversation switching, browser disconnects, Next.js request termination, and Mastra API/worker restarts.

**Architecture:** Next.js remains the public UI and same-origin proxy. A Mastra API process owns Evented Agents and run APIs. PostgreSQL stores authoritative thread, message, run, and snapshot state; Redis Streams carries cross-process Mastra events and Redis server cache replays missed durable-agent chunks. A separate Mastra worker consumes orchestration and background-task events.

**Tech Stack:** Next.js App Router, AI SDK v7, Mastra 1.71, `createEventedAgent`, `RedisStreamsPubSub`, `RedisServerCache`, PostgreSQL storage, SSE, local Node.js processes.

**Spec:** The user-approved three-batch architecture described in the conversation: task IDs and server state, shared Redis/database infrastructure, then split Mastra workers with reconnect and recovery.

## Global Constraints

- Preserve the existing AI SDK v7 chat message format and Markdown/tool trace UI.
- Switching conversations must detach only the browser subscription; it must never cancel the server run.
- `runId` and run status are authoritative on the server; browser `localStorage` is only a cache.
- Existing workflow approval APIs and Studio routes must continue to work.
- Local development uses a dedicated PostgreSQL database and Redis logical database in the existing shared infrastructure.
- Production split processes must use a shared database and Redis Streams; a local SQLite file is not a valid multi-container database.
- Verify each batch with focused tests, typecheck, project checks, and production build before claiming completion.

---

### Batch 1: Task ownership and reconnectable chat runs

**Files:**
- Create: `src/mastra/chat-runs.ts`
- Create: `src/mastra/chat-events.ts`
- Create: `src/app/api/chat/runs/route.ts`
- Create: `src/app/api/chat/runs/[runId]/route.ts`
- Create: `src/app/api/chat/runs/[runId]/events/route.ts`
- Create: `src/app/api/chat/runs/[runId]/cancel/route.ts`
- Modify: `src/mastra/agents/chat-agent.ts`
- Modify: `src/mastra/index.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/components/ChatPanel.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/lib/chat-sessions.ts`
- Test: `scripts/chat-runs.test.mjs`

**Interfaces:**
- `ChatRunStatus = 'queued' | 'running' | 'waiting_approval' | 'succeeded' | 'failed' | 'cancelled'`.
- `ChatRunRecord` contains `runId`, `threadId`, `resourceId`, `status`, `userMessage`, `assistantMessage`, `error`, `lastEventSeq`, and timestamps.
- `createChatRun(input): Promise<ChatRunRecord>` creates an idempotent run and starts the Evented Agent.
- `getChatRun(runId): Promise<ChatRunRecord | null>` returns server authority.
- `observeChatRun(runId, afterSeq): Promise<ReadableStream<Uint8Array>>` returns an SSE stream with replay and live events.
- `cancelChatRun(runId): Promise<ChatRunRecord>` only cancels an explicitly requested run.

- [ ] Write focused contract tests for status transitions, idempotent `clientRequestId`, and SSE event serialization.
- [ ] Run `node --test scripts/chat-runs.test.mjs` and confirm it fails because the run service does not exist.
- [ ] Implement the run service around the registered Evented Agent and persist run state through Mastra storage.
- [ ] Add POST/status/events/cancel routes with ownership checks and explicit terminal states.
- [ ] Change the Next chat route to create or proxy a run without using browser connection lifetime as task lifetime.
- [ ] Update the chat panel to reconnect by `runId` and sequence number after session switches.
- [ ] Preserve browser session data as a migration/cache layer while server state becomes authoritative.
- [ ] Run focused tests, typecheck, and existing checks.

### Batch 2: Shared persistence and event infrastructure

**Files:**
- Configure the existing PostgreSQL and Redis endpoints for this project.
- Create: `src/mastra/runtime-config.ts`
- Modify: `src/mastra/storage.ts`
- Modify: `src/mastra/index.ts`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `src/app/api/health/route.ts`
- Test: `scripts/runtime-config.test.mjs`

**Interfaces:**
- `getStorageConfig()` selects the project-specific PostgreSQL database through `DATABASE_URL`.
- `createMastraRuntimeInfra()` creates Redis Streams PubSub and Redis durable stream cache when `REDIS_URL` exists, otherwise uses the current in-process fallback.
- `RuntimeHealth` exposes `storage`, `pubsub`, `cache`, and `workerMode` without leaking credentials.

- [ ] Write tests for local fallback and production configuration validation.
- [ ] Run the runtime configuration tests and confirm they fail before implementation.
- [ ] Add compatible Mastra Redis/Redis Streams/Postgres dependencies.
- [ ] Verify the dedicated PostgreSQL database and Redis logical database in the running infrastructure.
- [ ] Configure Mastra `pubsub`, `cache`, `backgroundTasks`, and durable-agent recovery.
- [ ] Keep local `file:./data/mastra.db` development behavior when shared infrastructure is absent.
- [ ] Add health reporting and environment documentation.
- [ ] Run focused tests, typecheck, and build.

### Batch 3: Separate API and Worker processes

**Files:**
- Build the Mastra API and Worker as separate local artifacts.
- Create: `scripts/start-mastra-api.mjs`
- Create: `scripts/start-mastra-worker.mjs`
- Modify: `package.json`
- Modify: `src/mastra/index.ts`
- Modify: `.env.example`
- Test: `scripts/worker-config.test.mjs`

**Interfaces:**
- API process starts with `MASTRA_WORKERS=false` and serves public Mastra routes on port 4111.
- Worker process starts with `MASTRA_WORKERS=orchestration,backgroundTasks` and receives `MASTRA_STEP_EXECUTION_URL`.
- Next.js only calls the Mastra API through the same-origin proxy and does not instantiate the execution runtime for chat requests.

- [ ] Write tests for worker mode parsing and required split-process environment variables.
- [ ] Run them red.
- [ ] Add Mastra API and worker build/start scripts.
- [ ] Add local pnpm scripts for API and Worker artifacts.
- [ ] Ensure long-running research/sub-agent tools opt into Mastra background tasks with bounded timeouts.
- [ ] Add startup recovery and graceful shutdown hooks.
- [ ] Run the full project checks and build artifacts.
- [ ] Start local API and Worker processes against existing Redis/PostgreSQL and smoke test a conversation switch during a run.

## Verification Checklist

- `node --test scripts/chat-runs.test.mjs scripts/runtime-config.test.mjs scripts/worker-config.test.mjs`
- `pnpm typecheck`
- `pnpm check`
- `pnpm build`
- `git diff --check`
- API health reports the selected storage, PubSub, cache, and worker mode.
- A run remains `running` after its browser subscription disconnects.
- Reconnecting with the same `runId` does not create a second LLM run.
- A terminal run becomes `succeeded` or `failed`, never permanently `running`.
