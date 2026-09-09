# Stack

Everything OpenInstaDM needs to run: the application libraries, the web and
worker processes, the shared data services, and the deployment pieces. For
step-by-step setup instructions, see [SETUP.md](../SETUP.md).

## Application

| Layer | Tool |
| --- | --- |
| Framework | Next.js 16 App Router with Cache Components, Partial Prerendering, and Turbopack |
| UI | React 19, shadcn/ui, Base UI, Tailwind CSS 4, Phosphor Icons, Motion |
| Language | TypeScript 5.9 |
| ORM / database | Prisma 7 with the `@prisma/adapter-pg` driver and PostgreSQL |
| Queue / rate limiting | BullMQ 5 and `ioredis` on Redis |
| Server caching | Next.js `use cache` / `cacheLife` / `cacheTag`, plus durable PostgreSQL API snapshots |
| Client data | TanStack Query with IndexedDB persistence for inbox and Instagram media |
| Authentication | Auth.js / NextAuth 5 with Google and GitHub OAuth, plus optional Resend magic links |
| Email | Resend REST API for magic links and workspace invitations |
| Validation | Zod 4 |
| Charts | Recharts 3, lazy-loaded in the overview UI |
| Tests | Vitest 4 |
| Worker runtime | `tsx` running `worker/dm-worker.ts` |
| Instagram | Official Meta Graph API using Instagram Login |

## Runtime architecture

The product has two application processes sharing PostgreSQL, Redis, and the
encryption key:

- **Web app + API** (`npm run dev` / `npm start`): Next.js dashboard, auth
  flows, Instagram OAuth callback, Meta webhook receiver, read APIs, and cron
  endpoints. The production web app is designed for Vercel.
- **Worker** (`npm run worker`): long-running Node process that consumes the
  `dm-processing` BullMQ queue, performs Meta sends and follow-gate checks, and
  periodically reconciles recent comments that webhooks may have missed. It
  requires an always-on host and cannot run as a Vercel function.

The main event flow is:

```text
Instagram comment / DM
        -> Meta webhook or polling reconciler
        -> Next.js webhook route
        -> BullMQ dm-processing queue
        -> worker
        -> Meta Graph API + PostgreSQL DM log
```

## Shared services and persistence

- **PostgreSQL** stores workspaces, members, connected Instagram accounts,
  campaigns, DM logs, webhook events, operational events, tracked links,
  click analytics, and durable snapshots of Meta API data.
- **Redis** stores the BullMQ queue and per-account rate-limit state. It must
  provide native Redis TCP access; an HTTP-only Redis REST endpoint will not
  work with BullMQ.
- **API snapshots** reduce repeated Meta Graph API calls for profiles, posts,
  follower history, and overview data. Inbox conversations remain client-side
  cached and visibility-aware rather than being snapshotted in PostgreSQL.

The web app and worker must use the same `DATABASE_URL`, `REDIS_URL`, and
`ENCRYPTION_KEY`. `ENCRYPTION_KEY` is a 32-byte value represented as exactly 64
hex characters. The web app encrypts Instagram access tokens and the worker
decrypts them before sending; mismatched keys make every send fail.

## Scheduled jobs

Vercel runs these cron routes daily (configured in [`vercel.json`](../vercel.json)):

| Time (UTC) | Route | Purpose |
| --- | --- | --- |
| 05:00 | `/api/cron/refresh-tokens` | Refresh connected Instagram tokens |
| 06:00 | `/api/cron/attach-next-reel` | Attach the next eligible reel to campaigns |
| 07:00 | `/api/cron/snapshot-followers` | Capture follower-history snapshots |
| 08:00 | `/api/cron/snapshot-cleanup` | Remove expired snapshot payloads |

Each cron endpoint is protected by `CRON_SECRET` (falling back to
`NEXTAUTH_SECRET` when configured that way in the route).

## Reference deployment

The reference low-cost deployment is:

| Piece | Service | Notes |
| --- | --- | --- |
| Web app | Vercel Hobby | Next.js app and scheduled routes |
| PostgreSQL | Neon | Use a pooled connection URL where available |
| Redis | Redis Cloud, Upstash, or another native TCP Redis | Use a `redis://` or `rediss://` URL, not a REST URL |
| Worker | Always-on VM or container (for example Oracle Cloud, Railway, Render, or Fly.io) | Runs `npm run worker` continuously |
| Login email | Resend | Optional; OAuth can be used without it |
| Instagram API | Meta developer app with Instagram Login | Requires configured OAuth and webhook settings |

For local development, PostgreSQL 16 and Redis 7 are provided by
[`infra/docker/docker-compose.yml`](../infra/docker/docker-compose.yml). Start
them with:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Then run the web app and worker in separate terminals. Both are required for
comment-to-DM processing.

## Environment variables

The required and optional names currently used by the application are:

| Variable | Purpose |
| --- | --- |
| `NEXTAUTH_URL` | Canonical application URL |
| `NEXTAUTH_SECRET` | Auth and OAuth state signing secret |
| `CRON_SECRET` | Bearer secret for scheduled routes; route fallback is supported |
| `ENCRYPTION_KEY` | 64-hex-character key for Instagram token encryption |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Native Redis connection string |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `GITHUB_ID`, `GITHUB_SECRET` | Optional GitHub OAuth |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional magic-link and invitation email delivery |
| `META_GRAPH_API_VERSION` | Meta Graph API version, currently defaulting to `v26.0` |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Instagram Login OAuth credentials |
| `FACEBOOK_APP_SECRET` | Meta webhook signature verification |
| `WEBHOOK_VERIFY_TOKEN` | Meta webhook subscription verification |
| `COMMENT_POLL_INTERVAL_MS`, `COMMENT_POLL_DISABLED` | Worker polling controls |
| `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_CONNECTION_TIMEOUT_MS` | PostgreSQL pool tuning |
| `ENABLE_HUMAN_AGENT_TAG` | Enables the optional human-agent tag behavior |

Values belong in `.env` or the deployment host's secret settings, never in the
repository. Full setup and deployment guidance is in
[SETUP.md](../SETUP.md#environment-variables).
