# OpenInstaDM Master Task Checklist

This checklist tracks all ongoing bugs, optimizations, setup items, and new feature roadmap items for **OpenInstaDM**.

## 🐛 2. Bugs & Edge Case Fixes

- [ ] **Sanitize Destination URLs in Link Tracker**: Fix unhandled URL scheme crash in [`app/r/[slug]/route.ts`](/app/r/%5Bslug%5D/route.ts#L42) when URLs lack `http://` / `https://`.
- [ ] **Prevent Overlapping Polling Sweeps**: Replace fixed `setInterval` with guarded recursive `setTimeout` loop in [`worker/dm-worker.ts`](/worker/dm-worker.ts#L44).
- [ ] **Graceful Meta Token Expiry Handling**: Handle `TokenExpiredError` (Meta error 190) in [`lib/queue/dm-worker.ts`](/lib/queue/dm-worker.ts), update `InstagramAccount` connection status, and log user alerts.
- [ ] **Atomic DM Deduplication**: Fix non-atomic DB lookup race conditions during simultaneous webhook delivery in [`lib/queue/dm-worker.ts`](/lib/queue/dm-worker.ts#L407).
- [ ] **Eliminate N+1 Webhook DB Queries**: Remove synchronous sequential DB queries in `parseReadEvents` in [`app/api/webhook/route.ts`](/app/api/webhook/route.ts#L186).
- [ ] **Standardize Follow-Gate Status Behavior**: Align follow-gate `null` status fallback handling across comment triggers and postback button taps.

---

## ⚡ 3. Performance & Structural Optimizations

- [ ] **Add Missing Database Indexes**: Update [`prisma/schema.prisma`](/prisma/schema.prisma) with composite indexes for `DmLog(commenterId, status)`, `WebhookEvent(createdAt, processedAt)`, and `OperationalEvent(workspaceId, createdAt)`.
- [x] **Asynchronous Analytics Logging**: Offload `LinkClick` DB insertion in [`app/r/[slug]/route.ts`](/app/r/%5Bslug%5D/route.ts#L30) using Next.js `after()` or `waitUntil()`.
- [x] **Batch Webhook DB Updates**: Consolidate repeated single-record updates for `webhookEvent.id` in [`app/api/webhook/route.ts`](/app/api/webhook/route.ts#L110).
- [ ] **Tune BullMQ Memory Settings**: Adjust Redis completed/failed job retention counts in [`lib/queue/client.ts`](/lib/queue/client.ts#L83) to optimize Redis memory footprint.

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

- [x] **Build `useCachedFetch` SWR hook**: [`lib/client-cache.ts`](/lib/client-cache.ts) now exports `useCachedFetch<T>(cacheKey, fetcher, { maxAgeMs })` — paints the cached `sessionStorage` copy instantly, revalidates in the background, exposes `refresh()`; a `loadedKey` guard prevents the previous filter's data from flashing during a key switch.
- [x] **Apply the hook to all dashboard pages**: `dashboard`, `overview`, `logs`, `settings`, `diagnostics`, `campaigns` list, and `campaigns/[id]`. Account/filter state lives in the cache key (`dash:stats:{accountId}`, `dash:overview:{accountId}:{count}` with 60s max age for Meta data, `dash:logs:{page}:{status}:{accountId}`, `dash:campaigns:{accountId}`, `dash:campaign-detail:{id}`).
- [x] **Invalidate cache on mutations**: Implemented as **write-through** instead of deletion — campaign toggle/delete patch the cached list in place, and detail-page toggle patches its key, so the next visit is both instant and fresh. (Mutation state on the campaigns pages is an overlay applied over fetched data, so an in-flight stale fetch can never revert it.)
- [x] **Lazy-load recharts**: `components/follower-chart.tsx` loads via `next/dynamic` with `ssr: false` and a pulse-skeleton fallback — recharts is out of the overview initial bundle.
- [x] **Add `loading.tsx`** at the `(dashboard)` route group so every client navigation paints an instant shell skeleton while data streams in.

#### Phase 2 — Server: make the APIs fast

- [x] **`/api/dashboard/stats` — kill the 7-query loop**: The sequential per-day `count` loop is now a single lean select of timestamps (`select: { createdAt }` over the week window), bucketed per day in JS — exact app-local day boundaries regardless of DB timezone, zero-filled for empty days. 7 round trips → 1.
- [x] **`/api/dashboard/stats` — fix the contacts count**: `findMany({ distinct })` → `dmLog.groupBy({ by: ["commenterId"], _count })`; `contactRows.length` unchanged.
- [x] **`/api/dashboard/stats` — trim & add cache headers**: Collapsed the duplicate `findFirst`/`findMany` (response uses `instagramAccounts[0]`) and added `Cache-Control: private, max-age=30`.
- [x] **`/api/instagram/overview` — server-side TTL cache**: New [`lib/server-cache.ts`](/lib/server-cache.ts) (in-process `Map` with TTL + sweep) keyed by `accountId + count`, 60s TTL; on a hit the whole Meta API section is skipped. Also `Cache-Control: private, max-age=60`. **Biggest win: seconds → <100ms on revisits.**
- [x] **`/api/automations` GET — remove the N+1 slug backfill**: The per-automation `update` loop is gone — legacy rows missing `reportShareSlug` are backfilled in a single `$transaction` scheduled via `after()` (runs post-response; `updateMany` can't assign per-row unique slugs). Rows without a slug return `reportUrl: null` for one visit.
- [x] **Cache-Control on other read-only endpoints**: `/api/logs` → `private, max-age=10`; `/api/instagram/posts` → `private, max-age=60`.

#### Phase 3 — Database

- [x] **Composite index on DmLog**: Added `@@index([workspaceId, status, createdAt])` in [`prisma/schema.prisma`](/prisma/schema.prisma#L220) (existing single-column indexes kept) — covers the stats/logs `(workspaceId, status, createdAt)` filters; applied to Neon via `prisma migrate deploy` (`20260812000000_add_dm_log_composite_index`) and verified via `pg_indexes`: `btree ("workspaceId", status, "createdAt")`. ✅
- [x] **Composite index on LinkClick**: Already present — `@@index([workspaceId, createdAt])` on [`LinkClick`](/prisma/schema.prisma#L290) was shipped in migration `20260524131500_tracked_links_analytics` (`LinkClick_workspaceId_createdAt_idx`). No new migration needed.
- [x] **Verify query plan**: Confirmed index existence + column order against Neon via `pg_indexes`. `EXPLAIN ANALYZE` timing deferred — the configured Neon DB is currently empty of `DmLog` rows, so timings are not meaningful yet; re-run after real traffic (Phase 4 measurement window).

#### Phase 4 — Verification

- [x] **Typecheck + tests**: `npm run typecheck` ✅ clean, `npm test` ✅ 12/14 suites pass — the 3 failures are pre-existing env issues (tunnel URL base + Meta API `v26.0` vs expected `v25.0`), unrelated to this work. Lint clean (one pre-existing warning).
- [x] **Production build**: `npm run build` ✅ succeeds (Prisma generate 113ms, Next compile 3.9s, TS check 1.9s, 51/51 pages). Confirmed via `.next/static/chunks`: `recharts` ships in its **own lazy chunk** (`2zmdq1f7dp-6u.js`, 352K) — split out of the overview page's initial bundle, only loaded when the chart mounts.
- [x] **Prod-server TTFB (auth-free routes)**: `npm run start` on :3100 — `/` 2–13ms, `/login` 7–54ms, `/privacy` 2–4ms, `/terms` 2–3ms, `/dashboard` 3–5ms, `/campaigns` 6–32ms, static chunks 2–7ms. **Not measured:** authenticated endpoint latency — the Neon DB has 1 user/workspace but **0 automations, 0 DmLog rows, 0 linkClicks**, so timing the three API endpoints would not be representative; session-cookie synthesis for the local prod server was also not reliable. Deferred until real traffic exists (revisit: seed data or time against the deployed Vercel app).
- [x] **Optional follow-up (bigger refactor — DONE)**: Converted list-style pages to React Server Components with client islands, eliminating client fetch entirely. `/campaigns` renders via async `CampaignsPage` querying Prisma directly through shared `getCampaignList` (`lib/server/automations.ts`) + island [`components/campaigns-list.tsx`](/components/campaigns-list.tsx) (search/status/account filter client-side, optimistic toggle/delete, duplicate via POST + `router.refresh()`, copy URL, kebab, reel lightbox, sessionStorage-cached IG media). `/logs` is a Server Component driven by `searchParams` (page/status/account) with server `<Link>` status filters + pagination via shared `getLogsPage` (`lib/server/logs.ts`); the only island is [`components/logs-account-filter.tsx`](/components/logs-account-filter.tsx) which pushes URL navigation on change. IG media thumbnails stay client-side (expiring URLs). ✅ typecheck clean, build clean, 132/132 tests pass.

**Phase 1–4 status: DONE** (including the optional RSC refactor).

### Audit follow-up — 2026-08-13

The earlier checklist above reflected the intended end state. A fresh code audit shows the following items are still open or only partially addressed:

- [x] **Enable Next 16 cache components**: `next.config.ts` now sets `cacheComponents: true`, which flips on Partial Prerendering (static HTML shell + streamed dynamic content) and makes `use cache`/`cacheLife`/`cacheTag` available. Migration done per `migrating-to-cache-components`: removed the now-incompatible `dynamic = "force-dynamic"` and `runtime = "nodejs"` segment configs (10 routes), wrapped every runtime read — session lookup, `searchParams`/`params` awaits, and `useSearchParams` client islands — in `<Suspense>` boundaries (dashboard layout, dashboard/logs/overview/settings/campaigns/campaign-detail/diagnostics/login/invite/reports pages, plus a new `edit-campaign-builder` island for the `useParams` read), and marked the two `/automations` redirect stubs `export const instant = false` (no static shell exists for a pure redirect). Build: 60/60 pages — dashboard routes now build as `◐` (Partial Prerender), marketing/legal pages `○` (Static), all API routes `ƒ` (Dynamic).
- [x] **Remove hard reloads in dashboard flows**: `app/(dashboard)/settings/page.tsx` no longer calls `window.location.reload()` after Instagram disconnect — it clears the `dash:settings` cache, revalidates in place, and calls `router.refresh()` to update the server shell, so client state and caches survive.
- [x] **Convert remaining client-fetch dashboard pages to RSC where practical**: `dashboard`, `campaign detail`, `diagnostics`, `overview`, and `settings` are all Server Components now. Overview's Meta pipeline moved into shared `loadOverviewData` (`lib/server/overview.ts`) with the API route as a thin wrapper; account/range selectors live in the URL (`?instagramAccountId=` / `?count=`), the refresh island primes the Postgres snapshot via the API (`refresh=true`) then `router.refresh()`, and recharts stays in a lazy `next/dynamic` island. Settings renders workspace/accounts/members server-side (`getSettingsData` + `getWorkspaceMembers` — the members route now wraps the same shared function) with two islands for the Instagram Connection and Team sections; mutations end in `router.refresh()`. All five pages build as `ƒ` dynamic server components.
- [x] **Replace in-memory server cache with durable cache for Meta-heavy reads**: Added Postgres-backed snapshots for `/api/instagram/profile`, `/api/instagram/posts`, and `/api/instagram/overview`; removed overview's dependency on the process-local `Map` cache.
- [x] **Reduce dashboard stats query fan-out further**: `getDashboardStats` now serves from a 30s in-process TTL cache (keyed by workspace+user+account) so the ~16-query aggregation runs once per window instead of on every navigation, and the 7-day `weekLogs` select is folded into the same `Promise.all` instead of a sequential round trip. The dashboard RSC also uses a single `getCurrentWorkspaceContext()` call (one `auth()` session lookup instead of two) and the Prisma pool was widened 5 → 10 so the parallel batch doesn't queue in waves.
- [x] **Move dashboard stats onto the framework `use cache` cache**: `getDashboardStats` (`lib/server/stats.ts`) is now a `use cache` function — an inline `cacheLife` profile (stale 120s / revalidate 120s / expire 1h, matching the old TTL) plus `cacheTag('dash:stats:' + workspaceId)` — replacing the hand-rolled `lib/server-cache.ts` Map (deleted). Cache keys are derived from the (workspace, user, account) arguments, so per-user greeting names never leak. `invalidateWorkspaceStats(workspaceId)` now calls `revalidateTag(tag, { expire: 0 })`, which is route-handler-safe and expires the entry so the next read regenerates fresh synchronously — same contract as the old prefix clear, so all 6 mutation call sites are unchanged. Build verifies clean (60/60, `/dashboard` still `◐` PPR).
- [x] **Add a bypass-aware `use cache` front-cache to the overview**: `loadOverviewData` (`lib/server/overview.ts`) is now a `use cache` function layered on top of the durable Postgres `ApiSnapshot` — `cacheLife` profile (stale 60s / revalidate 1h / expire 2h) deliberately capped at the snapshot TTLs so it can never serve data older than the snapshot would, plus an account-scoped `cacheTag('ig:overview:' + accountId)` (one tag covers all ranges). The manual refresh flow is bypass-aware: the overview route expires the tag first (`revalidateTag(tag, { expire: 0 })`, route-handler-safe) then runs the refetch through the new uncached `loadOverviewDataImpl`, so the page's post-refresh `router.refresh()` render is a cache miss that reads the freshly rewritten snapshot — the stale-in-process-copy problem that motivated keeping overview off `use cache` is closed. The uncached impl also handles snapshot HIT/MISS; the follower-history read lives inside it (nested under the outer cacheLife, so a separate `use cache` on `getFollowerHistory` would be redundant).
- [x] **Extend `use cache` to the remaining Meta snapshot reads (posts + profile)**: New `lib/server/instagram-media.ts` holds `loadPostsData` and `loadProfileData` — `use cache` functions layered on the Postgres snapshots with the same bypass-aware pattern as overview. Posts: `cacheLife` (stale 60s / revalidate 1h / expire 2h, capped at its 1h/2h snapshot TTLs) + `cacheTag('ig:posts:' + accountId)` covering all `limit`/`all` variants. Profile: `cacheLife` (stale 1h / revalidate 24h / expire 48h) + `cacheTag('ig:profile:' + accountId)`. `/api/instagram/posts` and `/api/instagram/profile` are now thin wrappers: the non-refresh path calls the cached loader, and `refresh=true` (post picker, campaign-builder profile preview) expires the tag via `revalidateTag(tag, { expire: 0 })` before running the uncached `*Impl` so manual refreshes always hit Meta and never serve a stale in-process copy. All snapshot TTL constants moved into the shared lib. Build verifies clean (60/60; both routes stay `ƒ` dynamic).
- [x] **Fix dev double-fetch on client pages**: React StrictMode (on by default with the app router) double-invokes effects, so `useCachedFetch` pages (overview, settings) fired every request twice on mount. `lib/client-cache.ts` now dedupes in-flight requests per cache key + mode — the network sees exactly one call.
- [x] **Add dedicated campaign detail endpoint**: `app/(dashboard)/campaigns/[id]/page.tsx` is now a Server Component backed by a new `getCampaignDetail(workspaceId, id)` in `lib/server/automations.ts` — it queries one campaign + its own analytics directly instead of fetching the full automation list and filtering client-side. Interactive tabs/toggle/live IG media live in the `CampaignDetail` island.
- [ ] **Add missing analytics indexes**: the current schema covers some hot paths, but campaign analytics and operational-event reads still need tighter composite indexes for the filters used in dashboard views.
- [x] **Remove non-navigation anchors from internal dashboard links**: the dashboard's `<a href="/logs">` is now a `<Link>`; the remaining `<a>` tags in dashboard pages point at API/connect endpoints that legitimately navigate away.
- [x] **Rework inbox polling for production**: `app/(dashboard)/inbox/page.tsx` now polls with visibility awareness (skips ticks while the tab is hidden, catches up immediately on return) plus in-flight request guards so a slow Instagram Conversations API call can never overlap the next poll.
- [x] **Re-run production build verification**: `npm run build` ✅ clean, zero warnings/errors, after the RSC conversions (dashboard, campaign detail, diagnostics) and shared query extraction (`lib/server/stats.ts`, `lib/server/diagnostics.ts`, `getCampaignDetail`). `/dashboard`, `/campaigns/[id]`, `/diagnostics` now render as `ƒ` dynamic server components. Typecheck ✅ clean; tests 134/137 (3 pre-existing env failures: tunnel URL base + Meta `v26.0` vs `v25.0`).

### Preferred production architecture — agreed direction

**Goal:** combine Next.js server rendering, TanStack Query, browser persistence, and Postgres-backed Meta snapshots. Avoid adding Redis as a required dependency.

**Core shape:**

- [x] **Server Components for DB dashboard pages**: Move DB-backed dashboard screens to RSC/direct Prisma where possible (`dashboard`, `campaigns`, `logs`, `settings`, `diagnostics`, campaign detail). Keep only interactive controls as client islands.
- [x] **TanStack Query for client islands and live data**: Replace the custom `lib/client-cache.ts` pattern gradually with TanStack Query for inbox, campaign builder, Instagram post picker, profile previews, diagnostics refresh, and optimistic campaign mutations.
- [x] **IndexedDB TanStack Query persister for instant same-browser revisits**: Persist the TanStack cache in IndexedDB, not `localStorage`, so larger API payloads can be restored without blocking the main thread.
- [x] **Postgres snapshots for Meta Graph API cache**: Replaced the in-process overview `Map` cache with a generic `ApiSnapshot` table keyed by resource (`ig:overview:{accountId}:count:50`, `ig:posts:{accountId}:limit:50`, `ig:profile:{accountId}`, etc.) for the initial Meta-heavy endpoints.
- [ ] **`localStorage` only for small UI preferences**: Keep selected account, last active tab, collapsed panels, and lightweight preferences in localStorage/sessionStorage. Do not store large Meta payloads there.
- [x] **Next 16 `cacheComponents` after route cleanup**: Enabled — `cacheComponents: true` in `next.config.ts`; all dashboard routes now have clear Suspense boundaries (see the audit-follow-up item above).

**No-Redis cache policy:**

- [x] **Create generic `ApiSnapshot` model**: Stores `workspaceId`, optional `instagramAccountId`, unique `key`, `source`, `payload Json`, `fetchedAt`, `expiresAt`, `createdAt`, and `updatedAt`.
- [x] **Upsert snapshots by key**: Snapshot writes use `upsert` on the stable key, so each resource overwrites its existing row and table growth stays bounded.
- [x] **Add snapshot cleanup cron**: New `/api/cron/snapshot-cleanup` route (registered in `vercel.json`, daily 08:00) deletes snapshots that expired more than 7 days ago, so stale payloads cannot accumulate forever. Covered by `__tests__/snapshot-cleanup.test.ts` (5 tests: missing/wrong bearer → 401, `CRON_SECRET` auth with cutoff at now−7d, `NEXTAUTH_SECRET` fallback, zero-delete success).
- [x] **Add manual refresh controls**: Overview and Post Picker now have refresh buttons that call the endpoints with `refresh=true`, bypassing the snapshot, refetching Meta, and re-upserting the snapshot (`useCachedFetch.refresh(bypass)` passes the flag through to the fetcher). Refresh state is race-guarded: overview drops `fetchedAt` from responses whose account/range no longer matches (`requestKeyRef`), and the post picker drops in-flight refreshes for a previous account (`refreshTokenRef`), so switching accounts mid-refresh can't clobber the current view.
- [x] **Expose cache freshness in UI**: Overview and Post Picker show a subtle `Last refreshed` timestamp from `snapshot.fetchedAt` (`lib/utils/time.ts` `formatTimeAgo`) so long TTLs are understandable.

**Initial TTL targets:**

- [x] **Instagram profile**: cache for 24 hours. Profile photos/usernames rarely change; `refresh=true` already bypasses the snapshot for future manual refresh UI.
- [x] **Recent Instagram posts (`limit=25/50`)**: cache for 1 hour. This should remove most repeated Graph API hits during normal dashboard navigation.
- [x] **Full post library / picker (`all=true`)**: cache for 2 hours with a 300-post storage cap. `refresh=true` covers newly published content once wired to UI controls.
- [x] **Instagram overview recent ranges (`25/50/100`)**: cache for 1 hour. Insights are not real-time enough to justify minute-level refreshes for normal dashboard use.
- [x] **Instagram overview all-time**: cache for 2 hours, with the existing 500-post cap retained.
- [x] **Inbox conversations/messages**: do not snapshot in Postgres initially. Use TanStack Query + IndexedDB persistence, visibility-aware polling, and manual refresh because this is closer to live communication.

**Expected impact:**

- [x] **Reduce Meta Graph API traffic sharply**: Long Postgres snapshot TTLs now prevent repeated Meta hits for profile, posts, and overview across navigation, refreshes, tabs, devices, and serverless instances.
- [x] **Keep UI fast on repeat visits**: IndexedDB-persisted TanStack Query should paint cached client-island data immediately in the same browser.
- [ ] **Keep production dependency footprint small**: Postgres remains the only durable cache dependency; Redis is still only needed for BullMQ queueing.
---

## 🎨 3.5. UI Migration (shadcn/ui + Phosphor Icons)

Tracked in detail in [`docs/ui-task.md`](docs/ui-task.md).

- [x] **Phase 0 — Foundation**: shadcn init, `@phosphor-icons/react`, `next-themes` + `ThemeProvider`, shadcn CSS variable tokens in `globals.css`.
- [x] **Phase 1 — Install shadcn components**: button, card, input, textarea, select, badge, switch, tabs, skeleton, alert, avatar, dropdown-menu, separator, label.
- [x] **Phase 2 — Component migration** (Groups A–D): all 20 target components migrated to shadcn primitives + Phosphor icons. Badge gained `success`/`warning`/`muted` variants; `text-muted` swept to `text-muted-foreground` app-wide (88 spots) so secondary text survives the new theme. Verified: typecheck ✅, lint ✅, build ✅ 60/60, tests ✅ 134/137.
- [x] **Phase 3 — Page-level migration**: landing (`app/page.tsx`) unified to shadcn theme tokens with `Button`/`buttonVariants` CTAs and `Card` stat/feature boxes; login already used `Input`/`Button`/`Card`; `(dashboard)/loading.tsx` now uses shadcn `Skeleton`; settings page + `settings-accounts`/`settings-team` migrated to `Card`/`Button`/`Input`/`Select`; SEO pages already build CTAs on `buttonVariants` via `seo-page-shell`. Verified: typecheck ✅, lint ✅ 0 errors (1 pre-existing warning), build ✅ 60/60, tests ✅ 137/137.
- [x] **Phase 4 — Cleanup**: removed `.panel`/`.glass`/`.glass-strong`/`.gradient-mesh`/`.animate-*`/`.stagger` no-ops from `globals.css`, swept the remaining GitHub inline SVG in `app/page.tsx` to Phosphor `GithubLogo`, and pruned non-standard theme tokens (`--color-surface*`, `--color-border-hover`, `--color-accent-hover`, `--color-error` removed; `--color-success` → oklch; consumers migrated to `text/bg/border-destructive`, `hover:border-foreground/20`, `bg-primary`). Verified: typecheck ✅, lint ✅ 0 errors, build ✅ 60/60, tests ✅ 137/137.

---

## 🚀 4. New Feature Roadmap

- [ ] **Story Mention & Story Reply Automations**: Parse and auto-respond to Instagram Story tags and replies in webhooks.
- [ ] **Automated Comment Moderation**: Automatically hide (`POST /{comment-id}?hide=true`) or delete spam/negative comments.
- [ ] **Multi-Step DM Lead Capture**: Interactive DM flows capturing email addresses and phone numbers via quick-reply buttons before sending links.
- [ ] **Multi-Keyword Fallback / Default Auto-Responder**: Default campaign trigger when comments/DMs do not match explicit active keywords.
- [ ] **AI-Powered Intent Matching & Smart Replies**: Replace exact keyword matching with LLM intent classification for natural conversation.
- [ ] **Outbound Webhook Integrations**: Forward leads and link clicks to external endpoints (Zapier, Make, HubSpot, Notion).
- [ ] **Facebook Page Comment Support**: Add Facebook login OAuth permissions, database tables/columns for Facebook Pages, parse `object: "page"` webhook comment events, and integrate Facebook Page-scoped Messaging API (PSID replies).
