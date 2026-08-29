import type { SeoPageConfig } from "@/components/seo-page-shell";

const templateLinks = [
  { label: "DTC product link template", href: "/templates/dtc-product-link" },
  { label: "Real estate lead form template", href: "/templates/real-estate-lead-form" },
  { label: "Fitness plan template", href: "/templates/fitness-plan" },
  { label: "Browse every template", href: "/templates" },
];

export const manychatAlternativePage: SeoPageConfig = {
  eyebrow: "Manychat alternative",
  title: "A focused Manychat alternative for Instagram comment-to-DM campaigns",
  description:
    "OpenInstaDM is for teams that do not need a broad chatbot builder. It turns keyword comments into Meta-compliant private replies, tracked links, campaign analytics, and client reports.",
  primaryCta: "Try the focused alternative",
  bullets: [
    "Built around Instagram comments, posts, reels, and private replies.",
    "Official Meta API flow with no scraping or password sharing.",
    "Campaign templates, tracked links, and shareable client reports.",
    "Open-source core with hosted SaaS for agencies that want managed reliability.",
  ],
  sections: [
    {
      title: "Narrower by design",
      body: "Broad automation suites can be powerful, but they also add flow-builder weight. OpenInstaDM keeps the campaign path tight: keyword, post, reply, link, result.",
    },
    {
      title: "Agency proof",
      body: "Tracked links and shareable reports make it easier to show clients what happened after the comment, not just that a message was sent.",
    },
    {
      title: "Meta-first delivery",
      body: "Comment events are processed through webhooks, queued, deduped, checked against limits, and sent as private replies using the comment ID.",
    },
  ],
  comparisonTitle: "OpenInstaDM vs broad chatbot builders",
  comparisons: [
    {
      label: "Setup",
      ours: "Create a keyword campaign for a specific post or reel.",
      other: "Build and maintain a larger chatbot automation flow.",
    },
    {
      label: "Reporting",
      ours: "Campaign-level sends, skips, failures, clicks, CTR, and client report links.",
      other: "Usually broader conversation analytics that need cleanup for client reporting.",
    },
    {
      label: "Positioning",
      ours: "Instagram Campaign OS for agencies and campaign teams.",
      other: "General DM automation across many channels and use cases.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Is OpenInstaDM a full Manychat replacement?",
      body: "No. OpenInstaDM is intentionally focused on Instagram comment-to-DM campaigns. If you need a complete chatbot suite, use a broad platform. If you need fast campaign loops, OpenInstaDM is built for that.",
    },
    {
      title: "Does it support agencies?",
      body: "Yes. It supports multiple Instagram accounts, workspace members, account filters, analytics, and shareable reports, with no account limit.",
    },
  ],
};

export const templatesSeoPage: SeoPageConfig = {
  eyebrow: "Instagram comment-to-DM templates",
  title: "Instagram comment-to-DM templates for high-intent campaign replies",
  description:
    "Start with proven campaign patterns for product links, lead magnets, price replies, launch waitlists, coaching offers, events, and local services.",
  primaryCta: "Use a template",
  bullets: [
    "Template intent carries into signup and campaign creation.",
    "Each template includes keywords, a campaign goal, and reply copy.",
    "Tracked links turn template replies into measurable clicks.",
    "Agencies can reuse templates across client accounts.",
  ],
  sections: [
    {
      title: "Product link drops",
      body: "Use LINK, SHOP, BUY, or SIZE comments to send exact product pages, launch bundles, or collection links.",
    },
    {
      title: "Lead magnets",
      body: "Use GUIDE, CHECKLIST, PLAN, or START comments to send free resources and follow-up offers.",
    },
    {
      title: "Local services",
      body: "Use PRICE, BOOK, INFO, or TOUR comments to deliver booking links, quote forms, and local offer pages.",
    },
  ],
  comparisonTitle: "Template campaigns vs manual inbox replies",
  comparisons: [
    {
      label: "Speed",
      ours: "Launch from reusable campaign templates in minutes.",
      other: "Reply manually or rebuild the same campaign copy each time.",
    },
    {
      label: "Measurement",
      ours: "Use tracked links and keyword analytics per campaign.",
      other: "Rely on screenshots, inbox memory, or scattered link data.",
    },
    {
      label: "Reuse",
      ours: "Clone the same playbook across posts, reels, and client accounts.",
      other: "Repeat setup work for every campaign.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Can I edit the template copy?",
      body: "Yes. Templates are starting points. You can change keywords, private reply text, tracked destination URLs, and active status before launching.",
    },
    {
      title: "Do templates work for reels?",
      body: "Yes. Campaigns can target Instagram posts or reels returned by the connected professional account.",
    },
  ],
};

export const agenciesSeoPage: SeoPageConfig = {
  eyebrow: "Instagram DM automation for agencies",
  title: "Instagram DM automation for agencies managing client campaigns",
  description:
    "OpenInstaDM gives agencies multi-account workspaces, client-ready reports, tracked links, and a focused comment-to-DM workflow for repeatable Instagram campaigns.",
  primaryCta: "Start an agency workspace",
  bullets: [
    "Connect multiple client Instagram accounts on the Agency plan.",
    "Filter dashboards, logs, campaigns, and settings by account.",
    "Invite teammates as owners, admins, or members.",
    "Share read-only client reports without exposing workspace controls.",
  ],
  sections: [
    {
      title: "Client separation",
      body: "Account filters keep campaign creation, logs, and reporting cleaner when one workspace manages multiple brands.",
    },
    {
      title: "Repeatable offers",
      body: "Use templates to package lead magnets, product drops, price replies, and launch waitlists as repeatable agency services.",
    },
    {
      title: "Proof of work",
      body: "Shareable reports show sends, skips, failures, clicks, CTR, top keywords, and tracked links in a client-safe view.",
    },
  ],
  comparisonTitle: "Agency workflow vs generic automation",
  comparisons: [
    {
      label: "Client reporting",
      ours: "Public read-only campaign report links, unbranded, with no plan gating.",
      other: "Manual screenshots or dashboards that expose too much internal workspace context.",
    },
    {
      label: "Team roles",
      ours: "Owner, admin, and member roles with invite links.",
      other: "Often one shared login or overpowered teammate access.",
    },
    {
      label: "Account operations",
      ours: "Per-account filters for campaigns, logs, dashboard stats, and settings.",
      other: "Client work can get mixed across broad automation workspaces.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "How many Instagram accounts can agencies connect?",
      body: "The Agency plan is shaped for up to 10 connected Instagram professional accounts in the current launch packaging.",
    },
    {
      title: "Can clients see reports without logging in?",
      body: "Yes. Shareable report pages are public read-only links that hide private workspace controls and DM copy.",
    },
  ],
};

export const commentLinkSeoPage: SeoPageConfig = {
  eyebrow: "Comment LINK automation",
  title: "Comment LINK automation for Instagram posts and reels",
  description:
    "Let followers comment LINK, SHOP, GUIDE, or any keyword and receive the right private reply with a tracked destination URL.",
  primaryCta: "Automate comment LINK",
  bullets: [
    "Match exact keywords or whole-word phrases.",
    "Send Meta-compliant private replies from the triggering comment.",
    "Insert tracked links into replies with click analytics.",
    "Deduplicate comment jobs and log sent, skipped, and failed outcomes.",
  ],
  sections: [
    {
      title: "For product links",
      body: "Turn high-intent LINK comments into tracked visits to product pages, landing pages, waitlists, or checkout offers.",
    },
    {
      title: "For creator offers",
      body: "Send guides, free resources, course links, and coaching applications without manually watching the inbox.",
    },
    {
      title: "For launch spikes",
      body: "Queue and process campaign replies while a reel is getting attention, with plan and rate-limit checks in the worker.",
    },
  ],
  comparisonTitle: "Comment LINK automation vs manual link replies",
  comparisons: [
    {
      label: "Reply accuracy",
      ours: "Every matched comment gets the campaign reply tied to that post or reel.",
      other: "Manual replies are easy to miss when comments spike.",
    },
    {
      label: "Tracking",
      ours: "Tracked links connect private replies to click outcomes.",
      other: "Regular pasted links rarely show campaign-level performance.",
    },
    {
      label: "Compliance",
      ours: "Built around official private reply semantics and rate-aware queues.",
      other: "Unsafe browser automation or scraping can put accounts at risk.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Can I use keywords other than LINK?",
      body: "Yes. Each campaign can use multiple keywords such as PRICE, SHOP, GUIDE, PLAN, WAITLIST, TOUR, or your own phrase.",
    },
    {
      title: "Does OpenInstaDM send a normal Instagram DM?",
      body: "It sends a Meta-compliant private reply triggered by the comment event, using the Instagram comment ID.",
    },
  ],
};

export const linkdmAlternativePage: SeoPageConfig = {
  eyebrow: "LinkDM alternative",
  title: "The open-source LinkDM alternative for Instagram comment-to-DM",
  description:
    "OpenInstaDM does what LinkDM does — keyword comments trigger tracked private replies — but open-source, self-hostable, and without per-message markups. Official Meta API, no scraping.",
  primaryCta: "Try the LinkDM alternative",
  bullets: [
    "Same LINK / keyword → DM flow: comment triggers private reply with your link.",
    "Open-source & self-hostable — own your data, no vendor lock-in or message caps.",
    "Tracked short links with CTR, clicks, and campaign analytics out of the box.",
    "Agency-ready: multi-account workspaces, shareable client reports, full DM logs.",
  ],
  sections: [
    {
      title: "Drop-in replacement",
      body: "If you use LinkDM for LINK comments, OpenInstaDM is a 1:1 swap: pick a post/reel, set keywords like LINK, SHOP, GUIDE, and the worker delivers Meta-compliant private replies with your tracked URL.",
    },
    {
      title: "Own your stack",
      body: "Self-host with no seat limits or opaque AI markups. Your Postgres, your Redis, your encryption key. Hosted SaaS also available if you prefer managed.",
    },
    {
      title: "Prove the click",
      body: "Every reply can wrap your destination in a tracked redirect (/r/[slug]). See per-campaign clicks and CTR, not just sends.",
    },
  ],
  comparisonTitle: "OpenInstaDM vs LinkDM",
  comparisons: [
    {
      label: "Pricing",
      ours: "Free & open-source. Self-host unlimited, or SaaS without pay-per-DM surprise.",
      other: "Paid SaaS with tiered message/credit limits that scale with volume.",
    },
    {
      label: "Control",
      ours: "You host the code, data, and tokens (AES-256-GCM at rest). Export everything.",
      other: "Closed platform — your campaign data stays on their infra.",
    },
    {
      label: "Agency workflow",
      ours: "Multi-account workspaces, per-account filters, member roles, public report links.",
      other: "Single-account focus; agency reporting often manual.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Can I migrate from LinkDM easily?",
      body: "Yes. Recreate your LinkDM keywords and reply copy as an OpenInstaDM campaign on the same post/reel. Connect your Instagram professional account and you're live on the official Meta private replies API.",
    },
    {
      title: "Does it support reels and existing posts?",
      body: "Yes. Campaigns target posts or reels returned by the connected Instagram account, same as LinkDM post targeting.",
    },
  ],
};

export const chatfuelAlternativePage: SeoPageConfig = {
  eyebrow: "Chatfuel alternative",
  title: "A lean Chatfuel alternative for Instagram comment-to-DM",
  description:
    "Chatfuel is a full chatbot suite. If you just need Instagram keyword comments → private replies with tracking and logs, OpenInstaDM is the focused, open-source alternative.",
  primaryCta: "Try the lean alternative",
  bullets: [
    "Instagram-first: no general bot builder, just campaigns that convert comments to DMs.",
    "Official Meta private replies — no browser automation, no password sharing.",
    "Full DM logs (sent / skipped / failed / rate-limited) with reasons.",
    "Tracked links, CTR, and shareable reports for clients or teammates.",
  ],
  sections: [
    {
      title: "No flow-builder overhead",
      body: "Skip the canvas. Create a campaign: choose post, add keywords, write the DM and optional public reply, add a tracked link. Ship in minutes.",
    },
    {
      title: "Reliable delivery",
      body: "BullMQ queues, deduplication, rate-limit awareness, and webhook + polling reconciliation so spikes don't drop comments.",
    },
    {
      title: "Open & auditable",
      body: "MIT-licensed core. Inspect the queue, worker, Meta client, and encryption. Self-host or use the hosted version.",
    },
  ],
  comparisonTitle: "OpenInstaDM vs Chatfuel",
  comparisons: [
    {
      label: "Scope",
      ours: "Focused comment-to-DM Campaign OS for Instagram.",
      other: "Broad multi-channel chatbot platform with flow builder.",
    },
    {
      label: "Setup time",
      ours: "Minutes per campaign, reproducible via templates.",
      other: "Longer to model flows, handoffs, and channel rules.",
    },
    {
      label: "Reporting",
      ours: "Per-campaign clicks, CTR, status logs, and public client links.",
      other: "Bot-level analytics that need slicing for campaign proof.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Should I replace Chatfuel entirely?",
      body: "If Instagram comment-to-DM is your core loop, OpenInstaDM replaces that slice cleanly. Keep Chatfuel if you need full Messenger/WhatsApp bot journeys across channels.",
    },
    {
      title: "Is this compliant with Meta?",
      body: "Yes. Replies use the official Graph API private replies endpoint keyed by comment ID, with token refresh and rate handling.",
    },
  ],
};

export const instagramAutoDmPage: SeoPageConfig = {
  eyebrow: "Instagram Auto DM",
  title: "Instagram Auto DM that replies the second they comment",
  description:
    "OpenInstaDM is the free, open-source Instagram Auto DM tool: connect your professional account, set a keyword, and every matching comment gets an instant, Meta-compliant DM with your tracked link.",
  primaryCta: "Set up Auto DM",
  bullets: [
    "Keyword or whole-phrase matching (LINK, PRICE, GUIDE, or your own).",
    "Instant private replies via official Meta API + queued, rate-limited delivery.",
    "Tracked links show which comments actually turned into clicks.",
    "Works for posts, reels, and multiple Instagram accounts in one workspace.",
  ],
  sections: [
    {
      title: "24/7, no inbox watch",
      body: "Webhooks fire on each comment, the worker queues and sends private replies, and polling sweeps any events Meta didn't push.",
    },
    {
      title: "Safe for your account",
      body: "No scraping, no password sharing, no unofficial automation. Tokens encrypted with AES-256-GCM at rest.",
    },
    {
      title: "From comment to conversion",
      body: "Wrap any URL in a tracked redirect and measure CTR per campaign. Perfect for product drops, waitlists, and lead magnets.",
    },
  ],
  comparisonTitle: "Auto DM vs manual DMs",
  comparisons: [
    {
      label: "Speed",
      ours: "Replies in seconds, even when a reel goes viral at midnight.",
      other: "Manual replies lag, get missed, or copy-paste inconsistently.",
    },
    {
      label: "Tracking",
      ours: "Each send ties to a tracked link click and campaign log.",
      other: "No campaign-level attribution for pasted links.",
    },
    {
      label: "Ops",
      ours: "Queue, retry, dedupe, and log every outcome with a reason.",
      other: "Inbox memory and screenshots for proof.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Will Instagram flag Auto DM?",
      body: "Private replies are an official Meta feature for professional accounts. OpenInstaDM uses that API, respects rate limits, and avoids browser automation.",
    },
    {
      title: "Can I require a follow first?",
      body: "Yes. Enable follow-gating per campaign — the user gets a follow prompt until they follow, then the link is delivered.",
    },
  ],
};

export const instagramKeywordAutomationPage: SeoPageConfig = {
  eyebrow: "Instagram keyword automation",
  title: "Instagram keyword automation for high-intent comments",
  description:
    "Turn keywords like LINK, SHOP, GUIDE, PRICE, and WAITLIST into automatic private replies. OpenInstaDM matches exact or phrase keywords and delivers tracked links with full logs.",
  primaryCta: "Automate keywords",
  bullets: [
    "Multiple keywords per campaign, exact or whole-phrase matching.",
    "Per-keyword analytics: sends, skips, fails, clicks, and CTR.",
    "Deduped jobs — the same comment never triggers twice.",
    "Agency-friendly: reuse keyword playbooks across client accounts.",
  ],
  sections: [
    {
      title: "Own the intent",
      body: "A follower typing LINK or PRICE is high intent. Keyword automation captures that moment and moves it to a private, trackable reply.",
    },
    {
      title: "Template the playbook",
      body: "Save product, lead-magnet, and local-service keyword sets as templates and clone them across posts and reels.",
    },
    {
      title: "See what worked",
      body: "Logs explain every skip (wrong keyword, cooldown, limit) and tracked links prove which keyword actually drove clicks.",
    },
  ],
  comparisonTitle: "Keyword automation vs broad filters",
  comparisons: [
    {
      label: "Precision",
      ours: "Word-boundary matching, multiple keywords, campaign-scoped to one post/reel.",
      other: "Generic auto-responders that misfire or spam unrelated comments.",
    },
    {
      label: "Proof",
      ours: "Top keywords and CTR per campaign, shareable with clients.",
      other: "No per-keyword attribution; hard to iterate copy.",
    },
    {
      label: "Reuse",
      ours: "Templates carry intent into future campaigns.",
      other: "Rebuild keywords and replies each launch.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Can I use phrases like “send guide”?",
      body: "Yes. Add phrases and we match whole phrases, not just single words, so ‘send guide’ won’t trigger on ‘guide’ alone if you don't want it to.",
    },
    {
      title: "How do I avoid false positives?",
      body: "Use whole-word/phrase mode and scope campaigns to specific posts/reels. Logs show why non-matches were skipped.",
    },
  ],
};

export const autoReplyInstagramCommentsPage: SeoPageConfig = {
  eyebrow: "Auto reply Instagram comments",
  title: "Auto-reply Instagram comments without missing the spike",
  description:
    "Let OpenInstaDM auto-reply to Instagram comments via private DMs and optional public replies. Webhooks + polling reconciliation catch every comment, even when your reel blows up.",
  primaryCta: "Auto-reply comments",
  bullets: [
    "Private reply + optional public reply per campaign.",
    "Webhook first, polling sweep second — nothing slips through.",
    "Rate-limited queue with retries, dedupe, and full status logs.",
    "Connect multiple professional accounts and filter by account.",
  ],
  sections: [
    {
      title: "Handle the spike",
      body: "When a reel gets thousands of comments at once, the queue absorbs the burst, respects Meta rate limits, and logs each outcome.",
    },
    {
      title: "Both reply types",
      body: "Send a private DM with your tracked link and, if enabled, a short public reply so the commenter knows to check their inbox.",
    },
    {
      title: "Every comment accounted for",
      body: "See sent, skipped (wrong keyword/cooldown), failed, and rate-limited states with reasons — perfect for agency audits.",
    },
  ],
  comparisonTitle: "Auto-reply vs watching the inbox",
  comparisons: [
    {
      label: "Coverage",
      ours: "Catches live + missed events via reconciliation sweep.",
      other: "Human monitoring misses comments during spikes or off-hours.",
    },
    {
      label: "Consistency",
      ours: "Same reply, same link, same tracking for every match.",
      other: "Copy-paste drift and forgotten links.",
    },
    {
      label: "Reporting",
      ours: "Campaign dashboard with CTR and report links for clients.",
      other: "Manual tallies or no report at all.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Can I auto-reply to every comment?",
      body: "You can, but we recommend keyword scoping so only high-intent comments get the DM. You control the keywords per campaign.",
    },
    {
      title: "Does polling duplicate webhooks?",
      body: "No. Comment jobs are deduped by comment ID so a comment seen both ways is processed once.",
    },
  ],
};

export const instagramLeadMagnetAutomationPage: SeoPageConfig = {
  eyebrow: "Instagram lead magnet automation",
  title: "Turn GUIDE comments into leads on autopilot",
  description:
    "Give away your guide, checklist, or free plan in comments and deliver it by DM automatically. OpenInstaDM tracks clicks, handles follow-gates, and logs every send for creator and coaching funnels.",
  primaryCta: "Automate your lead magnet",
  bullets: [
    "Keywords like GUIDE, CHECKLIST, PLAN, START, FREE trigger the asset DM.",
    "Optional follow-gate before delivering the link — perfect for growth.",
    "Tracked link proves which post/reel and keyword drove the lead.",
    "Reuse across launches, cohorts, and client accounts via templates.",
  ],
  sections: [
    {
      title: "Built for creators & coaches",
      body: "Whether it's a Notion template, workout plan, or mini-course, map the magnet to a keyword and the DM sends the asset while you're filming the next reel.",
    },
    {
      title: "From comment to email",
      body: "Point the tracked link to a landing page or waitlist. Measure post-level conversion without leaving Instagram.",
    },
    {
      title: "Compound the asset",
      body: "One magnet, many campaigns. Swap the destination URL without rewriting the DM copy, and keep analytics intact.",
    },
  ],
  comparisonTitle: "Lead magnet automation vs manual sends",
  comparisons: [
    {
      label: "Delivery",
      ours: "Instant asset DM on every qualifying comment, queued at scale.",
      other: "Manual sends lag hours; hot leads go cold.",
    },
    {
      label: "Growth",
      ours: "Follow-gate option grows followers before delivering the asset.",
      other: "No built-in follower growth lever.",
    },
    {
      label: "Attribution",
      ours: "Per-campaign clicks, CTR, and top keywords for each magnet.",
      other: "No link between a post and actual asset downloads.",
    },
  ],
  templateLinks,
  faqs: [
    {
      title: "Can I swap the lead magnet file later?",
      body: "Yes. Update the tracked link destination and future DMs point to the new asset. Past clicks stay attributed to the campaign.",
    },
    {
      title: "Does it work with email capture pages?",
      body: "Yes. Send a tracked link to any URL — your ConvertKit, Beehiiv, or custom landing page — and measure clicks through the campaign.",
    },
  ],
};

