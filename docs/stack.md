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
| Jobs | Trigger.dev v4 tasks in `trigger/`, triggered from `lib/jobs/enqueue.ts` |
| Rate limiting | Postgres fixed-window counters (`lib/db/window-counter.ts`) |
| Server caching | Next.js `use cache` / `cacheLife` / `cacheTag`, plus durable PostgreSQL API snapshots |
| Client data | TanStack Query with IndexedDB persistence for inbox and Instagram media |
| Authentication | Auth.js / NextAuth 5 with Google and GitHub OAuth, plus optional Resend magic links |
| Email | Resend REST API for magic links and workspace invitations |
| Validation | Zod 4 |
| Charts | Recharts 3, lazy-loaded in the overview UI |
| Tests | Vitest 4 |
| Job runtime | Trigger.dev managed workers (`trigger/dm-processing.ts`) |
| Instagram | Official Meta Graph API using Instagram Login |

## Runtime architecture

The product has one deployable app and one managed job runner, sharing
PostgreSQL and the encryption key:

- **Web app + API** (`npm run dev` / `npm start`): Next.js dashboard, auth
  flows, Instagram OAuth callback, Meta webhook receiver, read APIs, and cron
  endpoints. The production web app is designed for Vercel. It triggers jobs but
  never executes them.
- **Job runner** (`trigger/dm-processing.ts`, deployed with
  `npm run trigger:deploy`): Trigger.dev tasks that perform Meta sends,
  follow-gate checks, and the hourly reconciliation of comments that webhooks
  missed. There is no always-on host to provision, and no queue library in the
  app.

The main event flow is:

```text
Instagram comment / DM
        -> Meta webhook or scheduled reconciler
        -> Next.js webhook route
        -> Trigger.dev dm-processing queue
        -> task -> lib/jobs/dm-handlers.ts
        -> Meta Graph API + PostgreSQL DM log
```

Job plumbing lives in three places and nowhere else:

| Concern | Module |
| --- | --- |
| Payload types, task ids, queue/concurrency, retry policy | `lib/jobs/types.ts` |
| Producing jobs (the only runner-aware producer) | `lib/jobs/enqueue.ts` |
| Task definitions and the reconciliation schedule | `trigger/dm-processing.ts` |

## Shared services and persistence

- **PostgreSQL** stores workspaces, members, connected Instagram accounts,
  campaigns, DM logs, webhook events, operational events, tracked links,
  click analytics, and durable snapshots of Meta API data.
- **Postgres** also stores the small amount of counters and liveness state the
  app needs: per-account DM rate limits, the hourly AI budget window, and the
  job runner's heartbeat (`WindowCounter`, `RunnerHeartbeat`). There is no Redis
  and no queue library in the app — Trigger.dev owns the queue.
- **API snapshots** reduce repeated Meta Graph API calls for profiles, posts,
  follower history, and overview data. Inbox conversations remain client-side
  cached and visibility-aware rather than being snapshotted in PostgreSQL.

The web app and the job runner must use the same `DATABASE_URL` and
`ENCRYPTION_KEY`. `ENCRYPTION_KEY` is a 32-byte value represented as exactly
64 hex characters. The web app encrypts Instagram access tokens and the runner
decrypts them before sending; mismatched keys make every send fail.

Where each variable belongs:

- **Web app (Vercel)**: every name below, plus `TRIGGER_SECRET_KEY` — without it
  the webhook cannot trigger any job.
- **Job runner (Trigger.dev dashboard, or `.env` for `npm run trigger:dev`)**:
  `DATABASE_URL`, `ENCRYPTION_KEY`, `NEXTAUTH_URL` (DM links are
  built from it, so a wrong value ships links to localhost), the Instagram app
  credentials, and the `AI_*` variables when AI replies are enabled. `trigger
  dev` reads `.env`, so a working local setup needs no extra copying. Setting
  `WORKER=true` there keeps the smaller Prisma pool described in
  `lib/db/client.ts`.
- **Trigger.dev CLI only**: `TRIGGER_PROJECT_REF`, used by `npm run
  trigger:deploy`.

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

The comment reconciliation sweep is not a Vercel cron: it runs hourly as the
`reconcile-comments` schedule in `trigger/dm-processing.ts`, because Vercel's
Hobby plan only fires crons once a day and the sweep needs to run every few
minutes to be a useful safety net.

## Reference deployment

The reference low-cost deployment is:

| Piece | Service | Notes |
| --- | --- | --- |
| Web app | Vercel Hobby | Next.js app and scheduled routes |
| PostgreSQL | Neon | Use a pooled connection URL where available |
| Job runner | Trigger.dev (free tier covers small volumes) | `npm run trigger:deploy`; tasks run on their managed workers |
| Login email | Resend | Optional; OAuth can be used without it |
| Instagram API | Meta developer app with Instagram Login | Requires configured OAuth and webhook settings |

For local development, PostgreSQL 16 is provided by
[`infra/docker/docker-compose.yml`](../infra/docker/docker-compose.yml). Start
it with:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Then run the web app and the Trigger.dev dev worker in separate terminals. Both
are required for comment-to-DM processing:

```bash
npm run dev          # web app, webhooks, dashboard
npm run trigger:dev  # executes the jobs the web app triggers
```

## Environment variables

The required and optional names currently used by the application are:

| Variable | Purpose |
| --- | --- |
| `NEXTAUTH_URL` | Canonical application URL |
| `NEXTAUTH_SECRET` | Auth and OAuth state signing secret |
| `CRON_SECRET` | Bearer secret for scheduled routes; route fallback is supported |
| `ENCRYPTION_KEY` | 64-hex-character key for Instagram token encryption |
| `DATABASE_URL` | PostgreSQL connection string |
| `TRIGGER_PROJECT_REF` | Trigger.dev project ref; required by the CLI to deploy tasks |
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key; required wherever jobs are triggered |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `GITHUB_ID`, `GITHUB_SECRET` | Optional GitHub OAuth |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional magic-link and invitation email delivery |
| `META_GRAPH_API_VERSION` | Meta Graph API version, currently defaulting to `v26.0` |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Instagram Login OAuth credentials |
| `FACEBOOK_APP_SECRET` | Meta webhook signature verification |
| `WEBHOOK_VERIFY_TOKEN` | Meta webhook subscription verification |
| `ENABLE_HUMAN_AGENT_TAG` | Enables the optional human-agent tag behavior |

Values belong in `.env` or the deployment host's secret settings, never in the
repository. Full setup and deployment guidance is in
[SETUP.md](../SETUP.md#environment-variables).
