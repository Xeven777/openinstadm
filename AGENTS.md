<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# OpenInstaDM Codebase Context & Agent Guide

This document provides context for AI agents working on **OpenInstaDM**. Read this to understand the project architecture, runtime requirements, data flow, key files, and operational rules.

---

## 🏗️ Architecture Overview

OpenInstaDM is an open-source Instagram comment-to-DM automation platform built with **Next.js 16 (React 19)**, **Trigger.dev**, and **Prisma 7 (PostgreSQL)**.

The application has **one deployable app plus a managed job runner**:

1. **Web Application & API Server (`npm run dev` / `next start`)**:
   - Serves the dashboard UI, auth flows (Resend magic links), workspace management, OAuth callback, and incoming Meta webhooks.
   - Produces jobs only (`lib/jobs/enqueue.ts`); it never executes them.
   - Deployed typically on **Vercel**.
2. **Job Runner (`trigger/dm-processing.ts`, deployed with `npm run trigger:deploy`)**:
   - Executes Meta Graph API calls to send DMs, button messages, and public replies, plus the hourly comment reconciliation sweep.
   - Runs on Trigger.dev's infrastructure: there is no always-on host, no worker container, and no BullMQ queue.
   - Requires `TRIGGER_PROJECT_REF` for deploys and `TRIGGER_SECRET_KEY` wherever the app triggers jobs.

There is no Redis and no queue library in the app. The per-account DM rate limit, the AI budget window, and the runner heartbeat are Postgres rows (`WindowCounter`, `RunnerHeartbeat`); recent worker alerts are the `OperationalEvent` rows `recordJobFailure` writes.

---

## 🔄 Core Data & Message Flow

```
[User Comments on IG Post]
        │
        ▼
[Meta Webhook POST] ──► [app/api/webhook/route.ts] (Verifies HMAC-SHA256 signature)
                                  │
                                  ▼
                   [Trigger DM job(s) via lib/jobs/enqueue.ts]
                                  │
                                  ▼
                        [trigger/dm-processing.ts]
                                  │
                                  ▼
                     [lib/jobs/dm-handlers.ts]
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
[processComment]           [processPostback]           [processMessage]
      │                           │                           │
      ▼                           ▼                           ▼
[Meta Graph API]           [Meta Graph API]           [Meta Graph API]
(Private/Public Reply)     (Button Reveal/Follow Gate) (Direct Message Auto-reply)
```

---

## 📁 Key File Map

| File Path                                                                                                                       | Description                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`app/api/webhook/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/api/webhook/route.ts)                       | Webhook verification endpoint and event routing into the Trigger.dev queue.                                                                              |
| [`app/api/instagram/callback/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/api/instagram/callback/route.ts) | Handles Meta Instagram OAuth callback, token exchange, encryption, and account linking.                                                                 |
| [`app/r/[slug]/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/r/%5Bslug%5D/route.ts)                         | Tracked short link redirect handler and analytics (`LinkClick`) logger.                                                                                 |
| [`trigger/dm-processing.ts`](file:///home/anish/Documents/github/openinstadm-main/trigger/dm-processing.ts)                       | Job runner: one Trigger.dev task per job type plus the hourly comment reconciliation schedule.                                                          |
| [`trigger.config.ts`](file:///home/anish/Documents/github/openinstadm-main/trigger.config.ts)                                     | Trigger.dev project ref, task directories, retry defaults, and max duration.                                                                            |
| [`lib/jobs/dm-handlers.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/jobs/dm-handlers.ts)                         | Core job execution logic: keyword matching, follow-gating, rate limiting, and Meta API sends.                                                            |
| [`lib/jobs/enqueue.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/jobs/enqueue.ts)                                 | Job producer facade. The only module that talks to the runner; used by the webhook route, the reconciler, and the handlers.                              |
| [`lib/jobs/types.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/jobs/types.ts)                                     | Job payload types, task ids, queue/concurrency settings, and the shared retry policy.                                                                    |
| [`lib/db/window-counter.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/db/window-counter.ts)                       | Atomic fixed-window counters in Postgres: DM rate limit and AI budget.                                                                                    |
| [`lib/polling/comment-reconciler.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/polling/comment-reconciler.ts)     | Polling safety net that sweeps recent post comments to catch comments filtered out by Meta webhooks.                                                    |
| [`lib/meta/client.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/meta/client.ts)                                   | Meta Graph API client, token refresh, follow status checks, and error wrappers (`TokenExpiredError`, `RateLimitError`).                                 |
| [`lib/meta/oauth.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/meta/oauth.ts)                                     | OAuth state signature validation and AES-256-GCM token encryption/decryption.                                                                           |
| [`lib/env.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/env.ts)                                                   | Strict environment variable validation (enforces 64-hex character `ENCRYPTION_KEY`).                                                                    |
| [`prisma/schema.prisma`](file:///home/anish/Documents/github/openinstadm-main/prisma/schema.prisma)                               | Full database schema containing `Workspace`, `InstagramAccount`, `Automation`, `DmLog`, `WebhookEvent`, `OperationalEvent`, `TrackedLink`, `LinkClick`. |
| [`SETUP.md`](file:///home/anish/Documents/github/openinstadm-main/SETUP.md)                                                       | Complete step-by-step setup guide for API keys, Meta developer app, and local/prod deployments.                                                         |
| [`task.md`](file:///home/anish/Documents/github/openinstadm-main/task.md)                                                         | Live master task checklist for bugs, performance optimizations, and feature roadmap.                                                                    |

---

## ⚡ Agent Operational Rules & Conventions

1. **Encryption Key Synchronization**:
   - `ENCRYPTION_KEY` MUST be a 32-byte hex string (64 hex characters generated via `openssl rand -hex 32`).
   - The exact same key must be present in both the Web App environment and the job runner's environment (Trigger.dev, or `.env` for `npm run trigger:dev`). Inability to decrypt tokens causes job processing failures (`Failed to decrypt Instagram access token`).

2. **Job Runner Requirement**:
   - The web app never sends a DM itself. In development, run `npm run trigger:dev` alongside `npm run dev`, or webhooks will enqueue jobs that nothing executes. In production, run `npm run trigger:deploy` — the tasks live in the `trigger/` directory and are not part of the Next.js build.
   - `TRIGGER_SECRET_KEY` must be present in the web app's environment or `lib/jobs/enqueue.ts` cannot trigger runs. `TRIGGER_PROJECT_REF` is what the CLI deploys against.

3. **No Redis, No Queue Library**:
   - Do not add a Redis client or a queue library. Jobs belong to Trigger.dev, and any state that needs to be shared atomically belongs in Postgres (see `lib/db/window-counter.ts` for the pattern).

4. **Prisma Client Output Location**:
   - Prisma client generates to `@/app/generated/prisma`. Use `npm run db:generate` before building or testing.

5. **Task Management**:
   - Check [`task.md`](file:///home/anish/Documents/github/openinstadm-main/task.md) before starting work to identify current open issues or planned features. Update checkboxes when completing items.
