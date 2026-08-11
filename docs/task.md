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

---

## 🚀 4. New Feature Roadmap

- [ ] **Story Mention & Story Reply Automations**: Parse and auto-respond to Instagram Story tags and replies in webhooks.
- [ ] **Automated Comment Moderation**: Automatically hide (`POST /{comment-id}?hide=true`) or delete spam/negative comments.
- [ ] **Multi-Step DM Lead Capture**: Interactive DM flows capturing email addresses and phone numbers via quick-reply buttons before sending links.
- [ ] **Multi-Keyword Fallback / Default Auto-Responder**: Default campaign trigger when comments/DMs do not match explicit active keywords.
- [ ] **AI-Powered Intent Matching & Smart Replies**: Replace exact keyword matching with LLM intent classification for natural conversation.
- [ ] **Outbound Webhook Integrations**: Forward leads and link clicks to external endpoints (Zapier, Make, HubSpot, Notion).
- [ ] **Facebook Page Comment Support**: Add Facebook login OAuth permissions, database tables/columns for Facebook Pages, parse `object: "page"` webhook comment events, and integrate Facebook Page-scoped Messaging API (PSID replies).

