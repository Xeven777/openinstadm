<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/cta-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="public/cta-light.png">
  <img alt="OpenInstaDM — open-source Instagram comment-to-DM automation" src="public/cta-light.png" width="100%">
</picture>

# OpenInstaDM

### 🚀 Open-source ManyChat alternative — turn Instagram comments into DMs automatically.

> An Instagram comment-to-DM automation platform that watches your posts, matches keywords in comments, and sends private (and public) replies through the **official Meta API**. No scraping. No browser automation. No monthly subscription.

<br>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Xeven777/openinstadm?style=social)](https://github.com/Xeven777/openinstadm/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Xeven777/openinstadm?style=social)](https://github.com/Xeven777/openinstadm/network/members)
[![GitHub issues](https://img.shields.io/github/issues/Xeven777/openinstadm)](https://github.com/Xeven777/openinstadm/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Xeven777/openinstadm)](https://github.com/Xeven777/openinstadm/pulls)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![Last commit](https://img.shields.io/github/last-commit/Xeven777/openinstadm)](https://github.com/Xeven777/openinstadm/commits/main)
[![Contributors](https://img.shields.io/github/contributors/Xeven777/openinstadm)](https://github.com/Xeven777/openinstadm/graphs/contributors)
[![Repo size](https://img.shields.io/github/repo-size/Xeven777/openinstadm)](https://github.com/Xeven777/openinstadm)
[![Commit activity](https://img.shields.io/github/commit-activity/m/Xeven777/openinstadm)](https://github.com/Xeven777/openinstadm/commits/main)

<br>

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss&logoColor=white)
![Auth.js](https://img.shields.io/badge/Auth.js-5-black)
![Meta API](https://img.shields.io/badge/Meta_Graph_API-0064E0?logo=meta&logoColor=white)

<br>

**Keywords:** `instagram-automation` · `comment-to-dm` · `manychat-alternative` · `meta-api` · `instagram-dm-bot` · `bullmq` · `nextjs` · `self-hosted`

[Documentation](SETUP.md) · [Tech Stack](docs/stack.md) · [Contributing](CONTRIBUTING.md) · [Report a Bug](https://github.com/Xeven777/openinstadm/issues)

</div>

**OpenInstaDM is a free, self-hosted Instagram comment-to-DM automation tool** — the open-source ManyChat alternative. Someone comments `LINK` on your reel, and they get a DM with your link a second later. That is the whole idea. OpenInstaDM watches the comments on your Instagram posts, and when a comment matches a keyword you set, it sends that person a private reply through the official Meta API. You can also post a public reply under the comment at the same time.

ManyChat does this and charges a monthly fee. OpenInstaDM is the same core feature — free, running on your own infrastructure, with no seat limits and no plan caps.

> [!TIP]
> If this saves you a subscription or a weekend of building, a ⭐ on the repo genuinely helps other people find it.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Set it up with your AI assistant](#set-it-up-with-your-ai-assistant)
- [Tech stack](#tech-stack)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

---

## Why this exists

Comment-to-DM is one feature, but every tool that offers it wants a recurring subscription for it. The actual work is a webhook, a keyword match, and one API call to Meta. That does not need to cost anything to run for a single account.

OpenInstaDM is built around Meta's official Instagram private replies. It does **not** scrape, it does **not** automate a browser, and it never asks for an Instagram password. That keeps your account inside Meta's rules, which matters if you care about not getting flagged.

---

## Features

| | |
| --- | --- |
| **Keyword to DM** | Match one or many keywords per post — whole-word or partial. |
| **Optional public reply** | Post a visible comment reply on top of the DM. |
| **Tracked links** | Swap a link for a tracked redirect and see clicks and CTR per campaign. |
| **Two link buttons** | Send up to two tappable link buttons in one DM, each a separate tracked link with its own click stats. |
| **Follow gate** | Optionally require a follow before you hand over the link. The DM asks the commenter to follow and tap a button; on tap, OpenInstaDM checks Meta's `is_user_follow_business` flag and only sends the link once they follow, re-prompting until then. It fails open (sends the link anyway) when Instagram does not return follow status, so a real follower is never trapped. |
| **Personalization** | Use `{username}` in your message to greet the commenter by name. |
| **Per-account rate limiting** | Stays under Meta's documented cap of 750 private replies per hour, and queues the overflow instead of dropping it. |
| **Multiple Instagram accounts** | Connect several professional accounts under one workspace, each with its own limits. |
| **Workspaces & permissions** | Owners can grant members access to automations, Instagram accounts, or team management — useful if you run this for clients. |
| **Campaign templates** | Start from a preset instead of a blank form. |
| **Inbox** | Read your Instagram DM conversations and reply from the dashboard, inside Meta's 24-hour messaging window. Cached so it loads instantly on repeat visits. |
| **DM logs** | Every send, skip, and failure is logged with a reason. |
| **Self-comment filtering** | Your own comments never trigger a reply, since Meta rejects DMing yourself anyway. |

---

## How it works

```
[User Comments on IG Post]
        │
        ▼
[Meta Webhook POST] ──►  app/api/webhook/route.ts   (verifies HMAC-SHA256 signature)
                                  │
                                  ▼
                        Enqueue BullMQ job ──►  worker/dm-worker.ts
                                  │                      │
                                  ▼                      ▼
                        lib/queue/dm-worker.ts    lib/meta/client.ts
                                  │                      │
            ┌─────────────────────┼──────────────────────┘
            ▼                     ▼                      ▼
      processComment      processPostback        processMessage
            │                     │                      │
            ▼                     ▼                      ▼
      Meta Graph API     Meta Graph API        Meta Graph API
   (Private/Public Reply)(Button Reveal/Follow)(Direct Message Auto-reply)
```

1. Someone comments on your Instagram post or reel.
2. Meta sends a webhook to your OpenInstaDM instance.
3. OpenInstaDM checks the comment against your active campaigns.
4. On a keyword match, it queues a job.
5. A background worker sends the private reply — and the public reply, if you enabled one.

The web app receives the webhook and serves the dashboard. A **separate worker process** does the sending, because the send has to survive rate limits and retries. Both talk to the same Postgres and Redis.

---

## Quick start

> [!IMPORTANT]
> You need a few free accounts before anything works: a **Meta developer app**, a **Resend** account for login emails, and somewhere to host (Vercel for the web app, Railway for the worker plus Postgres and Redis). The Instagram account you connect **must** be a Business or Creator account, not a personal one.

The honest version: the code deploys in minutes, but the Meta app setup is the part that takes real time. Read [SETUP.md](SETUP.md) before you start. It is the single setup guide — covering hosting, your domain, the environment, and every Meta wrong turn so you do not have to find them yourself.

### Deploy the web app

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Xeven777/openinstadm)

### Run it locally

```bash
git clone https://github.com/Xeven777/openinstadm.git
cd openinstadm
npm install
cp .env.example .env      # then fill in the values, see SETUP.md
docker compose -f infra/docker/docker-compose.yml up -d  # starts Postgres and Redis
npm run db:migrate
npm run dev               # web app on http://localhost:3000
npm run worker            # in a second terminal, this sends the DMs
```

> [!WARNING]
> **Two processes, always.** `npm run dev` serves the app and receives webhooks. `npm run worker` is what actually sends the messages. If comments come in and no DM ever arrives, the worker is the first thing to check.

Full environment variables and the production layout are in [SETUP.md](SETUP.md).

---

## Set it up with your AI assistant

If you use Claude Code, Cursor, or a similar tool, the Meta setup is a lot faster with an assistant driving it. There is a ready-made prompt in the [Set it up with an AI assistant](SETUP.md#set-it-up-with-an-ai-assistant) section of the setup guide. Paste it into your assistant inside a clone of this repo, hand over your keys as it asks, and it will walk you through connecting Instagram and going live.

---

## Tech stack

- **Next.js 16** and **React 19** for the web app and API routes
- **Prisma 7** with **PostgreSQL**
- **BullMQ** on **Redis** for the send queue and the worker
- **Auth.js (NextAuth)** with email magic links through **Resend**
- **Tailwind CSS** for the interface
- The official **Instagram API** with Instagram Login

For the complete stack — application libraries, the two runtime processes, and the free services this runs on (Vercel, Neon, Redis Cloud, an Oracle Cloud always-free VM for the worker, Resend, Meta) — see [docs/stack.md](docs/stack.md).

---

## Contributing

Issues and pull requests are welcome. If you hit a Meta quirk that is not in the setup guide, a PR that documents it is worth as much as a code fix, because that is where everyone loses time.

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## Credits

Built and maintained by **Anish Biswas**.

- GitHub: [@xeven777](https://github.com/xeven777)
- Website: [anish7.me](https://anish7.me)
- X: [@xevenbiswas](https://x.com/xevenbiswas)
- Instagram: [@anish_biswas_7_](https://instagram.com/anish_biswas_7_)

OpenInstaDM is a fork of [instagram-comment-to-dm](https://github.com/im-anishraj/instagram-comment-to-dm) by [Anish Raj](https://github.com/im-anishraj), also MIT licensed. The billing layer and plan caps were removed, and the setup was documented from scratch.

---

## Star the repo

If OpenInstaDM is useful to you, star it. It is the simplest way to help the project reach the next person looking for a free way to do this.

---

## License

[MIT](LICENSE).
