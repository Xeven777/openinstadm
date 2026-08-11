<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# OpenInstaDM Codebase Context & Agent Guide

This document provides context for AI agents working on **OpenInstaDM**. Read this to understand the project architecture, runtime requirements, data flow, key files, and operational rules.

---

## 🏗️ Architecture Overview

OpenInstaDM is an open-source Instagram comment-to-DM automation platform built with **Next.js 16 (React 19)**, **BullMQ**, **Prisma 7 (PostgreSQL)**, and **Redis**.

The application consists of **two separate processes** sharing the same PostgreSQL database, Redis connection, and encryption key:

1. **Web Application & API Server (`npm run dev` / `next start`)**:
   - Serves the dashboard UI, auth flows (Resend magic links), workspace management, OAuth callback, and incoming Meta webhooks.
   - Deployed typically on **Vercel**.
2. **Background Worker (`npm run worker` -> `worker/dm-worker.ts`)**:
   - Long-running Node.js process that consumes BullMQ job queues (`dm-processing`) and executes Meta Graph API calls to send DMs, button messages, and public replies.
   - Runs a periodic comment polling reconciler (`lib/polling/comment-reconciler.ts`) to catch comments missed by webhooks.
   - Deployed on an always-on host like **Railway**, **Render**, or **Fly.io**.

---

## 🔄 Core Data & Message Flow

```
[User Comments on IG Post]
        │
        ▼
[Meta Webhook POST] ──► [app/api/webhook/route.ts] (Verifies HMAC-SHA256 signature)
                                  │
                                  ▼
                        [Enqueue BullMQ Job]
                                  │
                                  ▼
                        [worker/dm-worker.ts]
                                  │
                                  ▼
                     [lib/queue/dm-worker.ts]
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
| [`app/api/webhook/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/api/webhook/route.ts)                       | Webhook verification endpoint and event routing into BullMQ queue.                                                                                      |
| [`app/api/instagram/callback/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/api/instagram/callback/route.ts) | Handles Meta Instagram OAuth callback, token exchange, encryption, and account linking.                                                                 |
| [`app/r/[slug]/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/r/%5Bslug%5D/route.ts)                         | Tracked short link redirect handler and analytics (`LinkClick`) logger.                                                                                 |
| [`worker/dm-worker.ts`](file:///home/anish/Documents/github/openinstadm-main/worker/dm-worker.ts)                                 | Worker process entrypoint; manages BullMQ worker lifecycle, heartbeats, and polling interval sweeps.                                                    |
| [`lib/queue/dm-worker.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/queue/dm-worker.ts)                           | Core worker execution logic: handles keyword matching, follow-gating, rate limiting, and Meta API sends.                                                |
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
   - The exact same key must be present in both the Web App environment and the Worker environment. Inability to decrypt tokens causes job processing failures (`Failed to decrypt Instagram access token`).

2. **Dual-Process Requirement**:
   - The system will NOT function without both `npm run dev` (or web app) AND `npm run worker` running simultaneously.

3. **Prisma Client Output Location**:
   - Prisma client generates to `@/app/generated/prisma`. Use `npm run db:generate` before building or testing.

4. **Task Management**:
   - Check [`task.md`](file:///home/anish/Documents/github/openinstadm-main/task.md) before starting work to identify current open issues or planned features. Update checkboxes when completing items.
