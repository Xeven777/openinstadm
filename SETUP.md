# 🚀 OpenReply Setup Guide

Welcome to OpenReply! This guide is designed for absolute beginners to help you set up and run OpenReply locally and in production.

OpenReply consists of **two parts** that must run at the same time:

1. **The Web App** (Next.js): Renders the dashboard, takes care of logins, and receives webhooks from Instagram.
2. **The Worker** (BullMQ): A background process that listens to incoming comments/DMs, checks rate limits, and sends the replies.

---

## 📋 Prerequisites

Before we start, you will need:

1. **An Instagram Business or Creator Account**: Personal accounts do not support the API. You can switch for free in Instagram's settings under **Settings** → **Account type**.
2. **A Facebook Account**: Meta's developer platform requires a Facebook account.
3. **A Resend Account**: Go to [Resend.com](https://resend.com) to create a free account. This is required to send login emails (magic links).
4. **Docker Desktop** (For local setup only): Download and install it from [Docker's website](https://www.docker.com/products/docker-desktop/).
5. **Node.js** (v18 or higher) installed on your machine.

---

## 🔑 Step 1: Generate your Environment Secrets

Open your terminal and run these commands to generate secure keys for your `.env` configuration:

```bash
# 1. Generate NEXTAUTH_SECRET (protects your dashboard sessions)
openssl rand -base64 32

# 2. Generate CRON_SECRET (protects token refresh endpoint)
openssl rand -base64 32

# 3. Generate ENCRYPTION_KEY (encrypts Instagram API tokens. MUST be exactly 64 hex characters)
openssl rand -hex 32

# 4. Generate WEBHOOK_VERIFY_TOKEN (custom password Meta uses to verify your webhook)
openssl rand -hex 16
```

---

## 💻 Step 2: Local Development Setup

1. **Clone the repository and install dependencies**:

   ```bash
   git clone https://github.com/diwenne/openreply.git
   cd openreply
   npm install
   ```

2. **Create your environment file**:

   ```bash
   cp .env.example .env
   ```

   Open the `.env` file in your text editor and fill in the values generated in Step 1.

3. **Start PostgreSQL & Redis (Datastores)**:
   Make sure Docker Desktop is running, then run:

   ```bash
   docker-compose up -d
   ```

   This downloads and starts PostgreSQL (database) and Redis (queue manager) in the background.

4. **Initialize the Database**:
   Run the following commands to create the tables in your database:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

---

## 🌐 Step 3: Setting Up a Public Tunnel

Because Instagram webhooks need to reach your local machine, you need a **public HTTPS URL**. Pick **one** of the three tunnel options below — they all do the same thing.

> **Tip**: Cloudflare Tunnel is the most reliable free option (no session time limits, no random URL changes on restart with a named tunnel). zrok is fully open-source and self-hostable. ngrok is the simplest to get started with.

---

### Option A — Cloudflare Tunnel (Recommended, Free)

Requires a free Cloudflare account. Gives you a **stable, named domain** (`*.trycloudflare.com` for quick tunnels, or your own domain with a named tunnel).

#### Quick Tunnel (no account needed, URL changes on restart)

1. **Install `cloudflared`**:
   - **Mac**: `brew install cloudflared`
   - **Linux**:
     ```bash
     curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
     chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
     ```
   - **Windows**: Download the installer from [Cloudflare's releases](https://github.com/cloudflare/cloudflared/releases/latest).

2. **Start a quick tunnel** (no sign-in required):

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

   Look for a line like:

   ```
   +-------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at            |
   |  https://example-random-words.trycloudflare.com             |
   +-------------------------------------------------------------+
   ```

   Copy that `https://...trycloudflare.com` URL.

3. **Update `.env`**:
   ```env
   NEXTAUTH_URL=https://example-random-words.trycloudflare.com
   ```

#### Named Tunnel (stable URL, survives restarts) — Requires Cloudflare account

1. **Log in**:

   ```bash
   cloudflared login
   ```

   This opens a browser window. Select your domain (or add one for free).

2. **Create the tunnel** (only once):

   ```bash
   cloudflared tunnel create openreply-dev
   ```

   Note the **Tunnel ID** printed in the output.

3. **Create a DNS record** (only once):

   ```bash
   cloudflared tunnel route dns openreply-dev dev.yourdomain.com
   ```

4. **Create a config file** at `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: openreply-dev
   credentials-file: /home/<your-user>/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: dev.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

5. **Start the tunnel**:

   ```bash
   cloudflared tunnel run openreply-dev
   ```

6. **Update `.env`**:
   ```env
   NEXTAUTH_URL=https://dev.yourdomain.com
   ```

---

### Option B — zrok (Open-Source, Free Tier)

zrok is a fully open-source tunnel built on top of OpenZiti. The public hosted service at `zrok.io` offers a generous free tier.

1. **Install zrok**:
   - **Mac**: [Check Docs](https://netfoundry.io/docs/zrok/how-tos/install/macos/)
   - **Linux**: [Check Docs](https://netfoundry.io/docs/zrok/how-tos/install/linux/)
   - **Windows**: [Check Docs](https://netfoundry.io/docs/zrok/how-tos/install/windows/)

2. **Create a free account** at [myzrok.io](https://myzrok.io/) and copy your **invite token**.

3. **Enable your environment** (only once):

   ```bash
   zrok2 invite
   # Follow the prompts — enter your email and verify it

   zrok2 enable <your-account-token>
   ```

4. **Start a public share**:

   ```bash
   zrok2 share public http://localhost:3000
   ```

   You will see output like:

   ```
   https://abc123.share.zrok.io
   ```

   Copy that URL.

5. **Update `.env`**:
   ```env
   NEXTAUTH_URL=https://abc123.share.zrok.io
   ```

> **Stable URL tip**: zrok reserved shares give you a fixed URL. Check here[here](https://netfoundry.io/docs/zrok/how-tos/shares/manage-reserved-names)

---

### Option C — ngrok (Classic, Free Tier)

1. **Install ngrok**:
   - **Mac**: `brew install ngrok`
   - **Windows/Linux**: Download from [ngrok's website](https://ngrok.com/download) and install.

2. **Authenticate ngrok**:
   Sign up for a free account at [ngrok.com](https://ngrok.com), copy your auth token, and run:

   ```bash
   ngrok config add-authtoken <your-auth-token>
   ```

3. **Start the tunnel**:

   ```bash
   ngrok http 3000
   ```

   You will see an output like:

   ```
   Forwarding   https://1a2b-3c4d.ngrok-free.app -> http://localhost:3000
   ```

   Copy the `https://...ngrok-free.app` URL.

4. **Update `.env`**:
   In your `.env` file, update the `NEXTAUTH_URL` variable:
   ```env
   NEXTAUTH_URL=https://1a2b-3c4d.ngrok-free.app
   ```

---

## 🛠️ Step 4: Configure the Meta Developer App

This is the most critical part of the setup. Follow these steps sequentially:

### 1. Create a Meta App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and log in.
2. Click **Create App**.
3. Select **Business** as the app type and click Next.
4. Set an App Name and Contact Email.
5. In the Use Cases screen:
   - Filter by "All" and select **Manage messaging and content on Instagram**.
   - 🚫 **Do NOT** select "Authenticate with Facebook Login" or "Marketing API".

### 2. Collect Your App Keys

In the Meta developer dashboard, copy these credentials into your `.env` file:

- **`FACEBOOK_APP_SECRET`**: Go to **App Settings** → **Basic** and click Show next to App Secret.
- **`INSTAGRAM_APP_ID` & `INSTAGRAM_APP_SECRET`**: Go to **Instagram** → **API Setup with Instagram Login** (in the sidebar).
  - Copy the **Instagram App ID** (a long number like `2036...`).
  - Copy the **Instagram App Secret** by clicking Show.

### 3. Add Your Instagram Tester Role

Meta apps in Development mode only allow authorized test accounts to connect.

1. On the Meta Dashboard, go to **App Roles** → **Roles** (or under the Instagram product).
2. Scroll to the **Instagram Testers** section, click **Add Testers**, and type your Instagram account username. Send the invite.
3. **On your phone (Crucial)**:
   - Open your Instagram app and go to your Profile.
   - Tap **Settings and activity** → **Apps and websites** → **Tester Invites**.
   - **Accept** the pending invite from your app.

### 4. Configure Redirect URIs & Webhooks

1. In the **Instagram** API Setup section on Meta:
   - Scroll to **Business login settings**.
   - Add your redirect URI (replace `<YOUR-TUNNEL-URL>` with the URL from Step 3):
     ```
     <YOUR-TUNNEL-URL>/api/instagram/callback
     ```
2. Go to **Instagram** → **Configure Webhooks**:
   - **Callback URL**: `<YOUR-TUNNEL-URL>/api/webhook`
   - **Verify Token**: Paste the `WEBHOOK_VERIFY_TOKEN` you generated in Step 1.
   - Click **Verify and Save**.
   - Under Subscription Fields, click **Subscribe** next to **`comments`** and **`messages`**.

### 5. Go Live

1. Go to **App Settings** → **Basic** and provide placeholder URLs for your tunnel domain (e.g. `<YOUR-TUNNEL-URL>/privacy`, `/terms`, `/data-deletion`).
2. Toggle the App Mode from **Development** to **Live** at the top of the Meta dashboard.

---

## 🏃‍♂️ Step 5: Start OpenReply

You must start two processes in separate terminal windows:

### Terminal 1: Web App

```bash
npm run dev
```

This runs the web interface on `http://localhost:3000` (which your tunnel from Step 3 is routing to).

### Terminal 2: Background Worker

```bash
npm run worker
```

This starts the background queue worker that processes the comments and DMs.

---

## ☁️ Step 6: Production Deployment (Vercel & Railway)

For hosting in production, we recommend:

- **Vercel** (Free): For hosting the front-end web app.
- **Railway** (Free/Hobby): For hosting PostgreSQL, Redis, and the background worker.

### 1. Railway Setup (Databases & Worker)

1. Log in to [Railway.app](https://railway.app) and click **New Project**.
2. Add **PostgreSQL** and **Redis** services.
3. Import your GitHub repository to deploy the Worker.
4. Under the Worker's Settings:
   - Set **Build Command** to: `npm run db:generate`
   - Set **Start Command** to: `npm run worker`
5. Add all variables in the Worker's **Variables** tab (use Railway's internal database URLs, e.g., `postgres.railway.internal`).

### 2. Vercel Setup (Web App)

1. Import your GitHub repository into Vercel.
2. In Vercel Project Settings, add all Environment Variables from your `.env`.
   - ⚠️ Use Railway's **Public Proxy URLs** (e.g., `*.proxy.rlwy.net`) for `DATABASE_URL` and `REDIS_URL`.
3. Deploy the application.

### 3. Run Migrations on Production Database

Run this command from your local machine to configure the production database:

```bash
DATABASE_URL="postgresql://postgres:password@your-railway-proxy.rlwy.net:5432/railway" npm run db:migrate
```

---

## 🔍 Troubleshooting & Common Errors

### 1. "Insufficient Developer Role" when connecting Instagram

- **Cause**: The Instagram account you are trying to connect has not been added as a Tester, or you forgot to accept the invite inside the Instagram app under _Settings_ → _Apps and Websites_ → _Tester Invites_.

### 2. Webhook Verification Fails

- **Cause**: Your `WEBHOOK_VERIFY_TOKEN` in Meta's dashboard does not match the `WEBHOOK_VERIFY_TOKEN` in your `.env` file, or your tunnel (ngrok / cloudflared / zrok) is not active.
- **Cloudflare Tip**: If using a quick tunnel, the URL changes every restart — update `NEXTAUTH_URL` and the Meta webhook URL each time, or use a named tunnel.
- **zrok Tip**: If using an ephemeral share, the URL changes every restart — use a reserved share (`zrok reserve`) for a stable URL.

### 3. Comments are logged, but DMs are not being sent

- **Cause**: Your background worker is not running.
- **Fix**: Check `https://<your-domain>/api/health` and verify `"worker": { "healthy": true }`. If it is `false`, start the worker using `npm run worker`.

### 4. Decryption errors in the worker

- **Cause**: The `ENCRYPTION_KEY` in your web app `.env` file does not match the `ENCRYPTION_KEY` set in your worker process. They must be completely identical.
