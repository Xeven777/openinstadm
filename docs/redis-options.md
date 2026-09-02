# Redis Options for OpenReply / OpenInstaDM

> Why this file exists: `BullMQ` (`lib/queue/client.ts:12`, `lib/queue/dm-worker.ts:239`) polls Redis even when idle. Upstash counts **every Redis command** — an idle worker alone burns ~2-8M commands/month. Upstash Free `500K/month` (~16K/day) dies in 2-3 days even with zero traffic. Use **memory-based limits** (Railway/Redis Cloud/Render/local Docker), not **per-command** billing.

Bullet summary:
- **Local dev:** Use `docker-compose.yml:21` (`redis:7-alpine`) -> `REDIS_URL=redis://localhost:6379` | Zero limits, zero cost.
- **Cloud prod (beginner):** Vercel (web) + Railway internal `redis.railway.internal:6379` (`SETUP.md:411`) | ~$5/mo credit, no command limit.
- **Cloud prod (Vercel-only):** Redis Cloud free 30MB (`rediss://...redis-cloud.com`) | No command limit.
- **Long-run cheapest:** Hetzner/Dokploy/Coolify VPS `$5-6/mo` runs Postgres + Redis + Worker unlimited.
- **Avoid:** Upstash Free for BullMQ (unless tuned + paid pay-as-you-go).

---

## Table of Contents
1. [How Redis Is Used Here](#how-redis-is-used-here)
2. [Why Upstash Free Burns So Fast](#why-upstash-free-burns-so-fast)
3. [Local Options (Long-Run)](#local-options-long-run)
4. [Cloud Options (Long-Run)](#cloud-options-long-run)
5. [Recommended Setup (Beginner, Long-Run)](#recommended-setup-beginner-long-run)
6. [If You Must Stay on Upstash](#if-you-must-stay-on-upstash)
7. [Future-Proof: Remove Redis Entirely](#future-proof-remove-redis-entirely)
8. [Verification & Troubleshooting](#verification--troubleshooting)

---

## How Redis Is Used Here

- **Queue:** `lib/queue/client.ts:80` `Queue<DmQueueJob>("dm-processing")` - webhook enqueues `process-comment` / `process-postback` / `process-message` (`app/api/webhook/route.ts:85`)
- **Worker:** `lib/queue/dm-worker.ts:239` `createDMWorker()` consumes jobs, concurrency 5
- **Rate limiter:** `lib/utils/rate-limiter.ts:24` `reserveDMSlot()` Lua script (`rate:dm:{instagramAccountId}`)
- **Health:** `worker/dm-worker.ts:11` heartbeat every `30s` -> `health:worker:dm` (`lib/ops/worker-health.ts:50`)
- **Polling safety net:** `worker/dm-worker.ts:19` reconciler every `15min` (`lib/polling/comment-reconciler.ts:64`)

Requires **two processes sharing same `REDIS_URL`, `DATABASE_URL`, `ENCRYPTION_KEY`** (`docs/stack.md:36`, `SETUP.md:419`).

BullMQ needs **TCP Redis** (`redis://` / `rediss://`). **Upstash REST HTTP URL will not work.**

---

## Why Upstash Free Burns So Fast

Default `BullMQ` Worker (`node_modules/bullmq/dist/esm/classes/worker.js:31`):

```
drainDelay: 5        // blocking XREADGROUP poll every 5s
stalledInterval: 30000  // check stalled jobs every 30s
lockDuration: 30000     // renew job locks every 15s
blockingConnection: true
```

Per idle worker:
- 1 blocking `XREADGROUP` + 3-5 `EVALSHA`/`PING`/`INFO` every 5s = ~17K polls/day = **~50K-120K Redis commands/day** per connection
- `lib/queue/client.ts:12` + `lib/utils/rate-limiter.ts:28` = **2 ioredis clients** per process, Worker duplicates to blocking + non-blocking = **3-4 TCP connections** = **2x-4x multiplier**
- Heartbeat `worker/dm-worker.ts:31` `30s` + health reads + `getJobCounts()` polling in dashboard
- Vercel serverless cold starts create **new** `INFO`/`CLIENT SETNAME` bursts per invocation

Result: `500K/month = 0.19 cmd/s` average. Idle BullMQ needs `1-3 cmd/s` -> **2.5M-8M/month with zero jobs**. Upstash `SETUP.md:111` `10K/day` is 3x smaller.

Verify in Upstash Console > Insights — >90% will be `EVALSHA`, `XREADGROUP`, `PING`.

---

## Local Options (Long-Run)

### Option A — Docker Compose (Recommended)

Already configured in `docker-compose.yml:21` and `infra/docker/docker-compose.yml:21`.

```bash
docker compose up -d              # starts postgres:16 (5432) + redis:7-alpine (6379)
docker compose ps                 # check healthy
redis-cli ping                    # -> PONG
```

`.env` (from `.env.example:10`):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/openinstadm
REDIS_URL=redis://localhost:6379
```

Pros: One command, volumes `pgdata`/`redisdata:/data` persist, exact parity with prod. `healthcheck: ["CMD", "redis-cli", "ping"]`.
Cons: Requires Docker Desktop.
Reset: `docker compose down -v && docker compose up -d && npm run db:generate && npm run db:migrate` (`SETUP.md:140`)

### Option B — Native Install (No Docker)

```bash
# macOS
brew install postgresql@16 redis
brew services start postgresql@16
redis-server --daemonize yes

# Ubuntu/Debian
sudo apt install postgresql redis-server
sudo systemctl start postgresql
redis-server --daemonize yes

createdb openinstadm
psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

`.env` same as Option A.

Pros: Lightest RAM, no Docker.
Cons: Manual service management after reboot (`brew services`, `systemctl`).

### Option C — DragonflyDB (Drop-in Redis Replacement)

Replace `image: redis:7-alpine` with `docker.dragonflydb.io/dragonflydb/dragonfly` in `docker-compose.yml`.
No code change — speaks native Redis protocol.

Pros: 5-10x throughput, lower memory.
Cons: Another image to understand.

---

## Cloud Options (Long-Run)

Comparison: **Beginner ease** sorted.

### 1. Railway Internal Redis (Recommended for this stack)

Matches official `SETUP.md:411` — **Vercel (web) + Railway (Postgres + Redis + Worker)**.

- **Cost:** Hobby `$5/mo` credit covers 256MB Redis + Postgres + Worker. No per-command limit, RAM/storage only.
- **Internal URL (worker uses):** `redis://default:<password>@redis.railway.internal:6379`
- **Public Proxy URL (Vercel uses):** `redis://default:<password>@<xxx>.proxy.rlwy.net:<port>` (`SETUP.md:425`)

Setup:
1. Railway > New Project > Add `PostgreSQL` + `Redis`
2. New Service > Deploy from GitHub > `Start Command: npm run worker`, `Build Command: npm run db:generate` (`SETUP.md:416`)
3. Worker Variables -> use **internal** hosts: `DATABASE_URL=...postgres.railway.internal...`, `REDIS_URL=...redis.railway.internal...`, `ENCRYPTION_KEY` (64 hex, same everywhere `openssl rand -hex 32`)
4. Vercel Project -> Variables -> use **proxy** hosts (copy from Railway Data -> Connect -> Public Network)
5. Migrate: `DATABASE_URL="proxy-url" npm run db:migrate` (`SETUP.md:432`)

Critical: **1 worker replica only**. 2 replicas = 2x Redis polling.

### 2. Redis Cloud (redis.io) — Vercel-Only Beginner

- **Cost:** Free `30MB / 30 connections` forever, then `Essentials $5/mo` for 100MB. No command limit.
- **URL:** `rediss://default:<password>@redis-1xxxx.c212.us-east-1-1.ec2.redns.redis-cloud.com:1xxxx` (TLS required)

Setup:
1. `redis.io` > Create Database > Free > Copy `Public endpoint`
2. Paste same `REDIS_URL` into Vercel **and** worker env (Fly/Render/Railway worker)
3. Must be `rediss://` (TLS)

Pros: Best free forever with no command billing, beginner UI.
Cons: 30MB small — fine for queue (queue trimmed `removeOnComplete: {count:1000}` `lib/queue/client.ts:83`).

### 3. Render Key-Value (Redis)

- **Cost:** Free `25MB` (90 day expiry, then sleep), `$10/mo` 1GB
- **Setup:** Render > New > Key Value > Copy `Internal` + `External` URL (same pattern as Railway)

Pros: One-click.
Cons: Free 25MB smaller, free tier sleeps.

### 4. Hetzner / Dokploy / Coolify Self-Host (Cheapest Long-Run)

Run `docker-compose.yml` on a VPS.

- **Cost:** Hetzner CX11 `€4.15/mo` / Contabo `$4.5/mo` VPS runs Postgres + Redis + Worker unlimited. Dokploy/Coolify free self-host PaaS.
- **Setup:**
  ```bash
  # on VPS
  git clone <your-repo>
  docker compose up -d
  # Dokploy: Git -> Build: npm run db:generate -> Start: npm run worker -> set env ENCRYPTION_KEY/DATABASE_URL/REDIS_URL
  ```

Pros: Fixed cost, no limits, data stays on your VPS, scales to 1000s DMs/hr.
Cons: You manage OS updates/backups. Need `nixpacks.toml` for Dokploy (`docs/deploy-dokploy.md:71`).

### 5. Fly.io / Aiven / Supabase

- **Fly.io Redis (Upstash on Fly):** Still Upstash under the hood — same per-command risk if ` fly redis` = Upstash.
- **Aiven Free:** Small free nodes (1 month trial) — no command limit but not always-free.
- **Use only if** you already run infra there.

### 6. Keep Upstash (Pay-As-You-Go, Tuned) — Last Resort

- **Cost:** Free `500K/mo`, then `$0.20 / 100K commands`. Idle BullMQ ~5M/mo = ~$10/mo unpredictable.
- **Requirement:** `rediss://` TCP URL, not REST.

---

## Recommended Setup (Beginner, Long-Run)

| Environment | Plan | REDIS_URL | DATABASE_URL |
|-------------|------|-----------|--------------|
| **Local dev** | Docker Compose Option A | `redis://localhost:6379` | `postgresql://postgres:postgres@localhost:5432/openinstadm` |
| **Prod web (Vercel)** | Railway Proxy | `redis://default:xxx@<proxy>.proxy.rlwy.net:<port>` | `postgresql://...@<proxy>.proxy.rlwy.net:5432/railway` |
| **Prod worker (Railway)** | Railway Internal | `redis://default:xxx@redis.railway.internal:6379` | `postgresql://...@postgres.railway.internal:5432/railway` |

All three services **must** share same `ENCRYPTION_KEY` (64 hex) (`SETUP.md:456`), else `Failed to decrypt Instagram access token` (`lib/meta/oauth.ts`).

Steps:
1. Local: `cp .env.example .env` -> set local `localhost` URLs -> `docker compose up -d` -> `npm run db:generate && npm run db:migrate` -> `npm run dev` (term 1) + `npm run worker` (term 2)
2. Prod: Create Railway Redis+Postgres -> deploy worker with internal URLs -> add proxy URLs to Vercel -> `DATABASE_URL="proxy" npm run db:migrate`
3. Meta app: webhook `https://<vercel-domain>/api/webhook`, OAuth `.../api/instagram/callback` (`SETUP.md:365`)

---

## If You Must Stay on Upstash

Apply patches to cut ~80% idle commands:

```ts
// 1. lib/utils/rate-limiter.ts:24 — DEDUP CLIENT (saves 50% connections)
import { getRedisConnection } from "@/lib/queue/client";
function getRedis(){ return getRedisConnection(); }
// remove: new Redis(process.env.REDIS_URL!, ...)

// 2. lib/queue/client.ts:12 — pipeline + no ready check
new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // REQUIRED by BullMQ
  enableReadyCheck: false,
  enableAutoPipelining: true,
})

// 3. lib/queue/dm-worker.ts:239 — SLOW THE POLL
new Worker("dm-processing", processJob, {
  connection: getRedisConnection(),
  concurrency: 5,
  drainDelay: 30,        // was 5  (6x fewer polls)
  stalledInterval: 120000, // was 30000
  lockDuration: 60000,
})

// 4. worker/dm-worker.ts:11 — SLOW HEARTBEAT + POLLING
const HEARTBEAT_INTERVAL_MS = 120_000; // was 30_000
const POLL_INTERVAL_MS = 30 * 60_000;  // was 15 * 60_000
// or disable in testing:
COMMENT_POLL_DISABLED=true  // .env
COMMENT_POLL_INTERVAL_MS=1800000
```

Also: run worker **only** when testing, ensure **1 replica**, avoid dashboard auto-refresh that hits `getJobCounts()` (`lib/server/diagnostics.ts:22`).

---

## Future-Proof: Remove Redis Entirely

If you outgrow Redis hosting concerns, switch queue to Postgres:

- `pg-boss` or `Graphile Worker` — jobs live in `Postgres` (your Neon/Railway DB), zero extra service.
- Pros: One DB to manage, serverless-friendly, no command limits, works on Vercel without TCP Redis.
- Cons: Requires rewriting `lib/queue/client.ts` and `lib/queue/dm-worker.ts` `Queue`/`Worker` logic.
- Keep BullMQ for now — migrate only when Redis cost/complexity outweighs rewrite cost.

---

## Verification & Troubleshooting

```bash
# local redis reachable?
redis-cli ping
redis-cli info | grep -i connected

# app health (checks redis + worker)
curl https://<your-domain>/api/health
# -> { redis: "PONG", worker: { healthy: true } } lib/ops/worker-health.ts

# if worker unhealthy: check heartbeat key TTL 120s
redis-cli get health:worker:dm
```

Common fixes:
- `REDIS_URL is HTTP-only — BullMQ needs native Redis TCP` (`app/docs/page.tsx:1279`) -> use `rediss://` not `https://`
- `Insufficient Developer Role` -> accept tester invite in Instagram app (`SETUP.md:440`)
- Webhook 401 -> `WEBHOOK_VERIFY_TOKEN` mismatch or tunnel down (`SETUP.md:442`)
- `No Instagram access token available` -> `ENCRYPTION_KEY` mismatch between web + worker (`SETUP.md:456`)
- Upstash spikes again -> `Upstash Console > Insights` check for `EVALSHA` — apply dedup patch above or switch to Railway/Redis Cloud.

---

*Last updated: 2026-08-29. Stack: Next.js 16, BullMQ 5.81.3, ioredis 5.11.1, Prisma 7, `docker-compose.yml` redis:7-alpine.*
