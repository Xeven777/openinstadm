# OpenInstaDM Master Task Checklist

This checklist tracks all ongoing bugs, optimizations, setup items, and new feature roadmap items for **OpenInstaDM**.

## 🐛 2. Bugs & Edge Case Fixes

- [ ] **Sanitize Destination URLs in Link Tracker**: Fix unhandled URL scheme crash in [`app/r/[slug]/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/r/%5Bslug%5D/route.ts#L42) when URLs lack `http://` / `https://`.
- [ ] **Prevent Overlapping Polling Sweeps**: Replace fixed `setInterval` with guarded recursive `setTimeout` loop in [`worker/dm-worker.ts`](file:///home/anish/Documents/github/openinstadm-main/worker/dm-worker.ts#L44).
- [ ] **Graceful Meta Token Expiry Handling**: Handle `TokenExpiredError` (Meta error 190) in [`lib/queue/dm-worker.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/queue/dm-worker.ts), update `InstagramAccount` connection status, and log user alerts.
- [ ] **Atomic DM Deduplication**: Fix non-atomic DB lookup race conditions during simultaneous webhook delivery in [`lib/queue/dm-worker.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/queue/dm-worker.ts#L407).
- [ ] **Eliminate N+1 Webhook DB Queries**: Remove synchronous sequential DB queries in `parseReadEvents` in [`app/api/webhook/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/api/webhook/route.ts#L186).
- [ ] **Standardize Follow-Gate Status Behavior**: Align follow-gate `null` status fallback handling across comment triggers and postback button taps.

---

## ⚡ 3. Performance & Structural Optimizations

- [ ] **Add Missing Database Indexes**: Update [`prisma/schema.prisma`](file:///home/anish/Documents/github/openinstadm-main/prisma/schema.prisma) with composite indexes for `DmLog(commenterId, status)`, `WebhookEvent(createdAt, processedAt)`, and `OperationalEvent(workspaceId, createdAt)`.
- [ ] **Asynchronous Analytics Logging**: Offload `LinkClick` DB insertion in [`app/r/[slug]/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/r/%5Bslug%5D/route.ts#L30) using Next.js `after()` or `waitUntil()`.
- [ ] **Batch Webhook DB Updates**: Consolidate repeated single-record updates for `webhookEvent.id` in [`app/api/webhook/route.ts`](file:///home/anish/Documents/github/openinstadm-main/app/api/webhook/route.ts#L110).
- [ ] **Tune BullMQ Memory Settings**: Adjust Redis completed/failed job retention counts in [`lib/queue/client.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/queue/client.ts#L83) to optimize Redis memory footprint.

### 🚦 Dashboard Performance Overhaul (detailed plan — phases 1→4)

**Goal:** (a) kill the reload-on-every-navigation behavior, (b) cut first-load latency on every dashboard page.

**Root causes (confirmed by audit):**
1. Every dashboard page is a `"use client"` component that fetches in `useEffect` on mount with no client cache → navigation remounts the page and refetches everything (`app/(dashboard)/dashboard/page.tsx#L48`, `overview/page.tsx#L43`, `logs/page.tsx#L59`, `settings/page.tsx#L59`, `diagnostics/page.tsx#L84`, `campaigns/[id]/page.tsx#L72`). Only campaigns thumbnails + inbox threads use the existing `lib/client-cache.ts` SWR cache.
2. `/api/instagram/overview` hits the Meta Graph API (paginated media + up to 500 per-post insight calls + follower history) with **zero caching** → slowest page in the app.
3. `/api/dashboard/stats` runs 16 queries, incl. **7 sequential per-day counts in a loop** and a `findMany({distinct})` over all DmLog rows to count contacts.
4. `/api/automations` GET performs **N+1 `update` calls** to backfill missing `reportShareSlug`s.
5. `DmLog`/`LinkClick` only have single-column indexes while hot filters are `(workspaceId, status, createdAt)`.
6. recharts (~100KB+ gzip) ships in the overview page's initial bundle.

#### Phase 1 — Client: instant revisits (fixes “loads every time I go and come back”)

- [x] **Build `useCachedFetch` SWR hook**: [`lib/client-cache.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/client-cache.ts) now exports `useCachedFetch<T>(cacheKey, fetcher, { maxAgeMs })` — paints the cached `sessionStorage` copy instantly, revalidates in the background, exposes `refresh()`; a `loadedKey` guard prevents the previous filter's data from flashing during a key switch.
- [x] **Apply the hook to all dashboard pages**: `dashboard`, `overview`, `logs`, `settings`, `diagnostics`, `campaigns` list, and `campaigns/[id]`. Account/filter state lives in the cache key (`dash:stats:{accountId}`, `dash:overview:{accountId}:{count}` with 60s max age for Meta data, `dash:logs:{page}:{status}:{accountId}`, `dash:campaigns:{accountId}`, `dash:campaign-detail:{id}`).
- [x] **Invalidate cache on mutations**: Implemented as **write-through** instead of deletion — campaign toggle/delete patch the cached list in place, and detail-page toggle patches its key, so the next visit is both instant and fresh. (Mutation state on the campaigns pages is an overlay applied over fetched data, so an in-flight stale fetch can never revert it.)
- [x] **Lazy-load recharts**: `components/follower-chart.tsx` loads via `next/dynamic` with `ssr: false` and a pulse-skeleton fallback — recharts is out of the overview initial bundle.
- [x] **Add `loading.tsx`** at the `(dashboard)` route group so every client navigation paints an instant shell skeleton while data streams in.

#### Phase 2 — Server: make the APIs fast

- [x] **`/api/dashboard/stats` — kill the 7-query loop**: The sequential per-day `count` loop is now a single lean select of timestamps (`select: { createdAt }` over the week window), bucketed per day in JS — exact app-local day boundaries regardless of DB timezone, zero-filled for empty days. 7 round trips → 1.
- [x] **`/api/dashboard/stats` — fix the contacts count**: `findMany({ distinct })` → `dmLog.groupBy({ by: ["commenterId"], _count })`; `contactRows.length` unchanged.
- [x] **`/api/dashboard/stats` — trim & add cache headers**: Collapsed the duplicate `findFirst`/`findMany` (response uses `instagramAccounts[0]`) and added `Cache-Control: private, max-age=30`.
- [x] **`/api/instagram/overview` — server-side TTL cache**: New [`lib/server-cache.ts`](file:///home/anish/Documents/github/openinstadm-main/lib/server-cache.ts) (in-process `Map` with TTL + sweep) keyed by `accountId + count`, 60s TTL; on a hit the whole Meta API section is skipped. Also `Cache-Control: private, max-age=60`. **Biggest win: seconds → <100ms on revisits.**
- [x] **`/api/automations` GET — remove the N+1 slug backfill**: The per-automation `update` loop is gone — legacy rows missing `reportShareSlug` are backfilled in a single `$transaction` scheduled via `after()` (runs post-response; `updateMany` can't assign per-row unique slugs). Rows without a slug return `reportUrl: null` for one visit.
- [x] **Cache-Control on other read-only endpoints**: `/api/logs` → `private, max-age=10`; `/api/instagram/posts` → `private, max-age=60`.

#### Phase 3 — Database

- [x] **Composite index on DmLog**: Added `@@index([workspaceId, status, createdAt])` in [`prisma/schema.prisma`](file:///home/anish/Documents/github/openinstadm-main/prisma/schema.prisma#L220) (existing single-column indexes kept) — covers the stats/logs `(workspaceId, status, createdAt)` filters; applied to Neon via `prisma migrate deploy` (`20260812000000_add_dm_log_composite_index`) and verified via `pg_indexes`: `btree ("workspaceId", status, "createdAt")`. ✅
- [x] **Composite index on LinkClick**: Already present — `@@index([workspaceId, createdAt])` on [`LinkClick`](file:///home/anish/Documents/github/openinstadm-main/prisma/schema.prisma#L290) was shipped in migration `20260524131500_tracked_links_analytics` (`LinkClick_workspaceId_createdAt_idx`). No new migration needed.
- [x] **Verify query plan**: Confirmed index existence + column order against Neon via `pg_indexes`. `EXPLAIN ANALYZE` timing deferred — the configured Neon DB is currently empty of `DmLog` rows, so timings are not meaningful yet; re-run after real traffic (Phase 4 measurement window).

#### Phase 4 — Verification

- [x] **Typecheck + tests**: `npm run typecheck` ✅ clean, `npm test` ✅ 12/14 suites pass — the 3 failures are pre-existing env issues (tunnel URL base + Meta API `v26.0` vs expected `v25.0`), unrelated to this work. Lint clean (one pre-existing warning).
- [x] **Production build**: `npm run build` ✅ succeeds (Prisma generate 113ms, Next compile 3.9s, TS check 1.9s, 51/51 pages). Confirmed via `.next/static/chunks`: `recharts` ships in its **own lazy chunk** (`2zmdq1f7dp-6u.js`, 352K) — split out of the overview page's initial bundle, only loaded when the chart mounts.
- [x] **Prod-server TTFB (auth-free routes)**: `npm run start` on :3100 — `/` 2–13ms, `/login` 7–54ms, `/privacy` 2–4ms, `/terms` 2–3ms, `/dashboard` 3–5ms, `/campaigns` 6–32ms, static chunks 2–7ms. **Not measured:** authenticated endpoint latency — the Neon DB has 1 user/workspace but **0 automations, 0 DmLog rows, 0 linkClicks**, so timing the three API endpoints would not be representative; session-cookie synthesis for the local prod server was also not reliable. Deferred until real traffic exists (revisit: seed data or time against the deployed Vercel app).
- [x] **Optional follow-up (bigger refactor — DONE)**: Converted list-style pages to React Server Components with client islands, eliminating client fetch entirely. `/campaigns` renders via async `CampaignsPage` querying Prisma directly through shared `getCampaignList` (`lib/server/automations.ts`) + island [`components/campaigns-list.tsx`](file:///home/anish/Documents/github/openinstadm-main/components/campaigns-list.tsx) (search/status/account filter client-side, optimistic toggle/delete, duplicate via POST + `router.refresh()`, copy URL, kebab, reel lightbox, sessionStorage-cached IG media). `/logs` is a Server Component driven by `searchParams` (page/status/account) with server `<Link>` status filters + pagination via shared `getLogsPage` (`lib/server/logs.ts`); the only island is [`components/logs-account-filter.tsx`](file:///home/anish/Documents/github/openinstadm-main/components/logs-account-filter.tsx) which pushes URL navigation on change. IG media thumbnails stay client-side (expiring URLs). ✅ typecheck clean, build clean, 132/132 tests pass.

**Phase 1–4 status: DONE** (including the optional RSC refactor).
---

## 🚀 4. New Feature Roadmap

- [ ] **Story Mention & Story Reply Automations**: Parse and auto-respond to Instagram Story tags and replies in webhooks.
- [ ] **Automated Comment Moderation**: Automatically hide (`POST /{comment-id}?hide=true`) or delete spam/negative comments.
- [ ] **Multi-Step DM Lead Capture**: Interactive DM flows capturing email addresses and phone numbers via quick-reply buttons before sending links.
- [ ] **Multi-Keyword Fallback / Default Auto-Responder**: Default campaign trigger when comments/DMs do not match explicit active keywords.
- [ ] **AI-Powered Intent Matching & Smart Replies**: Replace exact keyword matching with LLM intent classification for natural conversation.
- [ ] **Outbound Webhook Integrations**: Forward leads and link clicks to external endpoints (Zapier, Make, HubSpot, Notion).
- [ ] **Facebook Page Comment Support**: Add Facebook login OAuth permissions, database tables/columns for Facebook Pages, parse `object: "page"` webhook comment events, and integrate Facebook Page-scoped Messaging API (PSID replies).

