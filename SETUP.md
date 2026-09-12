# 🚀 OpenInstaDM Setup Guide

Welcome to OpenInstaDM! This guide is designed for absolute beginners to help you set up and run OpenInstaDM locally and in production.

OpenInstaDM consists of **two parts** that must run at the same time:

1. **The Web App** (Next.js): Renders the dashboard, takes care of logins, and receives webhooks from Instagram.
2. **The Worker** (BullMQ): A background process that listens to incoming comments/DMs, checks rate limits, and sends the replies.

---

## 📋 Prerequisites

Before we start, you will need:

1. **An Instagram Business or Creator Account**: Personal accounts do not support the API. You can switch for free in Instagram's settings under **Settings** → **Account type**.
2. **A Facebook Account**: Meta's developer platform requires a Facebook account.
3. **A Resend Account**: Go to [Resend.com](https://resend.com) to create a free account. This is required to send login emails (magic links).
4. **PostgreSQL & Redis** (one of): Docker Desktop, a local install, or a free cloud account (Neon/Supabase + Upstash). Docker is **optional** — see Step 2.
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
   git clone https://github.com/xeven777/openinstadm.git
   cd openinstadm
   npm install
   ```

2. **Create your environment file**:

   ```bash
   cp .env.example .env
   ```

   Open the `.env` file in your text editor and fill in the values generated in Step 1.

3. **Start PostgreSQL & Redis (Datastores)**:

   Docker is not required. Pick **one** option per datastore — either run Postgres/Redis **locally**, or use a **free cloud** service.

   ### Option A — Local install (no Docker)

   Install PostgreSQL and Redis directly on your machine:

   - **macOS**: `brew install postgresql@16 redis`
   - **Ubuntu/Debian**: `sudo apt install postgresql redis-server`
   - **Windows**: Installers from [postgresql.org](https://www.postgresql.org/download/) and [redis.io](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/).

   Then start them:

   ```bash
   # Postgres (macOS via brew)
   brew services start postgresql@16
   # Postgres (Debian/Ubuntu)
   sudo systemctl start postgresql

   # Redis (either platform)
   redis-server --daemonize yes
   ```

   Create the database and a user matching `.env.example`:

   ```bash
   createdb openinstadm
   psql -c "ALTER USER postgres PASSWORD 'postgres';"
   ```

   Your `.env` stays as shipped:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/openinstadm
   REDIS_URL=redis://localhost:6379
   ```

   > On Debian/Ubuntu the default Postgres user is `postgres`, but `pg_isready`/`psql` need `sudo -u postgres`. If the password fails, run `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"`.

   ### Option B — Free cloud Postgres + Redis (no local setup, no Docker)

   The free tiers below are plenty for local development:

   | Service | What it gives you | Free tier | 
   | ------- | ----------------- | --------- |
   | [Neon](https://neon.tech) | Serverless Postgres | 0.5 GB storage, branch-based DB |
   | [Supabase](https://supabase.com) | Postgres + connection pooling | 500 MB, always free |
   | [Aiven](https://aiven.io) | Postgres or Redis | Small free nodes per service |
   | [Upstash](https://upstash.com) | Redis (serverless) | 10k commands/day, always free |

   1. Sign up, create an instance, and copy the connection string for each.
   - **Neon/Supabase**: gives a `postgresql://...` URL → paste into `DATABASE_URL`.
   - **Upstash/Aiven Redis**: gives a `rediss://...` URL → paste into `REDIS_URL`.

   2. Update `.env`:

   ```env
   DATABASE_URL=postgresql://user:password@your-neon-host/dbname?sslmode=require
   REDIS_URL=rediss://user:password@your-upstash-host:6379
   ```

   > **Tip**: Prefer the pooler/connection-URL, not the direct one, on Supabase/Neon — Prisma handles pooled connections much better. Make sure the `sslmode=require` (or `?ssl=true` for Supabase) param is present, or Prisma will refuse to connect.

   Docker alternative (if you ever want it): `infra/docker/docker-compose.yml` provides the exact same Postgres (port `5432`) and Redis (port `6379`) for consistent local dev. Run it from the repository root with the `-f infra/docker/docker-compose.yml` option. See the "To reset everything" snippet below.

4. **Initialize the Database**:
   Run the following commands to create the tables in your database:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

   - `db:generate` generates the Prisma client from `prisma/schema.prisma`.
   - `db:migrate` applies the migration files in `prisma/migrations/` to the database (the `openinstadm` database created by the container).

   **To reset everything later** (stop containers, delete all DB/queue data, start fresh):

   ```bash
   docker compose -f infra/docker/docker-compose.yml down -v
   docker compose -f infra/docker/docker-compose.yml up -d
   npm run db:generate && npm run db:migrate
   ```

   No Docker? Reset your local Postgres/Redis by dropping the database and re-creating it:

   ```bash
   dropdb openinstadm && createdb openinstadm
   npm run db:generate && npm run db:migrate
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
   cloudflared tunnel create opendm-dev
   ```

   Note the **Tunnel ID** printed in the output.

3. **Create a DNS record** (only once):

   ```bash
   cloudflared tunnel route dns opendm-dev dev.yourdomain.com
   ```

4. **Create a config file** at `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: opendm-dev
   credentials-file: /home/<your-user>/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: dev.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

5. **Start the tunnel**:

   ```bash
   cloudflared tunnel run opendm-dev
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

## 🏃‍♂️ Step 5: Start OpenInstaDM

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

## ☁️ Step 6: Production Deployment

For every production layout, the web app and worker must use the same Postgres database, the same Redis instance, and the exact same `ENCRYPTION_KEY`. The worker may use an internal Docker hostname for Redis while Vercel uses a public TLS hostname; those URLs can differ, but they must reach the same Redis instance.

Choose one of these layouts:

- **Vercel** (Free): For hosting the front-end web app.
- **Railway** (Free/Hobby): For PostgreSQL, Redis, and the background worker.
- **Vercel + Neon + VM Compose**: Vercel hosts the web app, Neon hosts Postgres, and a VM runs the published worker image plus Redis. This is documented below.

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

### Option B — Vercel + Neon + VM Compose (Worker + Redis)

This option is useful when the web app is deployed on Vercel, Postgres is hosted on Neon, and you want a long-running worker plus Redis on your own VM. It uses the public Docker Hub image:

```text
sounogh/openinstadm-worker:latest
```

The image is public, so `docker login` is not required. Prefer an immutable release tag when one is available instead of continuously following `latest`.

#### 1. Prepare the VM

Use a Linux VM with a reserved public IP and Docker Engine with the Compose plugin installed. On Ubuntu, Docker's [official installation guide](https://docs.docker.com/engine/install/ubuntu/) is the recommended starting point.

Create a directory that contains only deployment configuration and secrets; a source-code checkout is not required on this VM:

```bash
sudo install -d -m 700 -o "$USER" -g "$USER" /opt/openinstadm/redis
cd /opt/openinstadm
```

Create `.env` for Compose interpolation. Generate a URL-safe Redis password with `openssl rand -hex 32` and use the result below:

```dotenv
WORKER_IMAGE=sounogh/openinstadm-worker:latest
REDIS_PASSWORD=replace-with-a-long-random-hex-password
```

Create `.env.worker`. Use Neon's pooled connection URL and the **same** encryption key already configured in Vercel. Do not put a `REDIS_URL` in this file: Compose provides the worker's internal URL.

```dotenv
NEXTAUTH_URL=https://yourfrontend.url.app
DATABASE_URL='postgresql://USER:PASSWORD@YOUR-NEON-POOLER.neon.tech/neondb?sslmode=require'
ENCRYPTION_KEY=the-same-64-character-hex-key-used-by-vercel
META_GRAPH_API_VERSION=v26.0
COMMENT_POLL_INTERVAL_MS=1800000   #comment poll every 30 minutees
COMMENT_POLL_LOOKBACK_HOURS=72
COMMENT_POLL_MAX_PER_SWEEP=30
# Set this to false after the initial infrastructure check if comment polling is desired.
COMMENT_POLL_DISABLED=true


```

Protect both files:

```bash
chmod 600 .env .env.worker
```

#### 2. Configure Redis authentication

Create `redis/users.acl`. The password after `>` must exactly match `REDIS_PASSWORD` in `.env`:

```text
user default off
user openinstadm on >replace-with-a-long-random-hex-password ~* &* +@all -@dangerous +info
```

`+info` is intentional: ioredis uses Redis's `INFO` command for its readiness check. Without it, the worker repeatedly logs a `NOPERM ... info` error.

The official Redis image drops privileges to its `redis` user. Give that user read access to the mounted ACL file without making the file broadly readable:

```bash
REDIS_IDS="$(docker run --rm --entrypoint sh redis:7-alpine -c 'awk -F: '\''$1 == "redis" { print $3 ":" $4 }'\'' /etc/passwd')"
sudo chown "$REDIS_IDS" redis/users.acl
sudo chmod 600 redis/users.acl
```

#### 3. Create the Compose file

Create `compose.yaml` in `/opt/openinstadm`:

```yaml
name: openinstadm

services:
  redis:
    image: redis:7-alpine
    command:
      - redis-server
      - --appendonly
      - "yes"
      - --protected-mode
      - "yes"
      - --aclfile
      - /usr/local/etc/redis/users.acl
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:?Set REDIS_PASSWORD in .env}
    expose:
      - "6379"
    volumes:
      - redis-data:/data
      - ./redis/users.acl:/usr/local/etc/redis/users.acl:ro
    healthcheck:
      test: ["CMD-SHELL", "redis-cli --user openinstadm --pass \"$$REDIS_PASSWORD\" ping"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  worker:
    image: ${WORKER_IMAGE:-sounogh/openinstadm-worker:latest}
    env_file:
      - .env.worker
    environment:
      WORKER: "true"
      REDIS_URL: redis://openinstadm:${REDIS_PASSWORD:?Set REDIS_PASSWORD in .env}@redis:6379
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  # Start only after the certificate and haproxy.cfg below have been created.
  redis-tls:
    image: haproxy:3.1-alpine
    profiles: ["public-redis"]
    ports:
      - "6380:6380"
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
      - ./certs/redis.pem:/usr/local/etc/haproxy/certs/redis.pem:ro
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  redis-data:
```

There is deliberately no `ports: ["6379:6379"]` declaration. `redis` is reachable only by Compose services until the optional TLS proxy is enabled.

Validate, pull the public image, and start the private worker stack:

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 worker
```

`redis` must report `healthy`, and the worker log must not contain `getaddrinfo ENOTFOUND redis`. The `restart: unless-stopped` policy brings both containers back after Docker or VM restarts.

#### 4. Make this Redis instance available to Vercel over TLS

Skip this subsection if Vercel uses managed Redis instead. If Vercel is to enqueue jobs into the VM Redis instance, it must connect through a public TLS endpoint; it can never use Docker's internal hostname `redis`.

1. Reserve a static external IP for the VM and create a DNS `A` record such as `redis.example.com` pointing to it. If DNS is hosted at Cloudflare, set this record to **DNS only** (grey cloud); Cloudflare's standard HTTP proxy does not proxy Redis TCP traffic.
2. Obtain a public TLS certificate for that hostname. One simple route is Certbot's standalone HTTP challenge. Temporarily allow inbound TCP `80` in the cloud and host firewall, then run:

   ```bash
   sudo apt update
   sudo apt install -y certbot
   sudo certbot certonly --standalone \
     --email YOU@example.com \
     --agree-tos --no-eff-email \
     -d redis.example.com
   ```

   Keep port `80` reachable when using this renewal method, or use your DNS provider's Certbot plugin instead. Do not use a Cloudflare Origin Certificate: Vercel connects directly and requires a publicly trusted certificate.

3. Create the HAProxy configuration at `/opt/openinstadm/haproxy.cfg`:

   ```cfg
   global
     log stdout format raw local0
     ssl-default-bind-options ssl-min-ver TLSv1.2

   defaults
     mode tcp
     log global
     option tcplog
     timeout connect 5s
     timeout client 1m
     timeout server 1m

   frontend redis_tls
     bind :6380 ssl crt /usr/local/etc/haproxy/certs/redis.pem
     default_backend redis_internal

   backend redis_internal
     server redis redis:6379 check
   ```

4. Build the certificate bundle HAProxy expects. `fullchain.pem` must precede `privkey.pem`:

   ```bash
   sudo install -d -m 700 /opt/openinstadm/certs
   sudo sh -c 'cat \
     /etc/letsencrypt/live/redis.example.com/fullchain.pem \
     /etc/letsencrypt/live/redis.example.com/privkey.pem \
     > /opt/openinstadm/certs/redis.pem'
   sudo chmod 600 /opt/openinstadm/certs/redis.pem
   ```

5. Start and check the TLS proxy:

   ```bash
   docker compose --profile public-redis up -d
   docker compose logs --tail=100 redis-tls
   ```

6. In the cloud firewall, allow inbound TCP `6380` to the VM. If your Vercel plan provides static egress IPs, restrict the source range to those IPs. Otherwise, the endpoint is reachable from the internet, so do not omit TLS, the ACL user, or the long random password. Never expose port `6379`.

7. In Vercel, set a server-only Production environment variable and redeploy:

   ```dotenv
   REDIS_URL=rediss://openinstadm:YOUR_REDIS_PASSWORD@redis.example.com:6380
   ```

   Do **not** name this variable `NEXT_PUBLIC_REDIS_URL`. Browser code must never receive Redis credentials. Vercel uses this external `rediss://` URL; the VM worker continues to use the internal `redis://...@redis:6379` URL from Compose.

#### 5. Run migrations and verify the shared deployment

Run migrations against Neon from a trusted machine or CI job before sending production traffic:

```bash
DATABASE_URL='YOUR_NEON_DATABASE_URL' npm run db:migrate
```

In Vercel, set `DATABASE_URL` to the same Neon database and set `ENCRYPTION_KEY` to the exact value in `.env.worker`. After deployment, submit a test event through the web app and check:

```bash
cd /opt/openinstadm
docker compose logs -f worker
```

The VM worker should consume the BullMQ job created by Vercel. Before changing Vercel from another Redis provider to the VM endpoint, drain or intentionally abandon jobs still waiting in the old Redis instance; queues are not copied automatically.

#### 6. Renew the certificate

Create `/etc/letsencrypt/renewal-hooks/deploy/reload-redis-tls` so HAProxy reloads its certificate after renewal:

```bash
#!/bin/sh
set -eu

cat \
  /etc/letsencrypt/live/redis.example.com/fullchain.pem \
  /etc/letsencrypt/live/redis.example.com/privkey.pem \
  > /opt/openinstadm/certs/redis.pem

chmod 600 /opt/openinstadm/certs/redis.pem
docker compose -f /opt/openinstadm/compose.yaml restart redis-tls
```

Enable it and verify the renewal path:

```bash
sudo chmod 700 /etc/letsencrypt/renewal-hooks/deploy/reload-redis-tls
sudo certbot renew --dry-run
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
