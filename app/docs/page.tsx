import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  Cloud,
  Database,
  Globe,
  Lightning,
  ListChecks,
  PlugsConnected,
  ShieldCheck,
  Terminal,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CodeBlock, InlineCode } from "@/components/docs/code-block";
import Navbar from "@/components/sections/navbar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Setup Guide — OpenInstaDM Docs",
  description:
    "Beginner-friendly, step-by-step setup guide for OpenInstaDM. From secrets and local Postgres & Redis to Meta webhooks, tunnelling, and production on Vercel + Railway.",
};

const toc = [
  { id: "overview", label: "Overview", step: null },
  { id: "prerequisites", label: "Prerequisites", step: null },
  { id: "step-1", label: "1 — Generate secrets", step: "01" },
  { id: "step-2", label: "2 — Local development", step: "02" },
  { id: "step-3", label: "3 — Public tunnel", step: "03" },
  { id: "step-4", label: "4 — Meta app", step: "04" },
  { id: "step-5", label: "5 — Start the app", step: "05" },
  { id: "step-6", label: "6 — Production", step: "06" },
  { id: "troubleshooting", label: "Troubleshooting", step: null },
  { id: "env", label: "Environment reference", step: null },
  { id: "architecture", label: "How it works", step: null },
];

function StepBadge({ n }: { n: string }) {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-xs font-black tracking-widest text-primary-foreground">
      {n}
    </span>
  );
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
      <Icon weight="bold" className="size-4" aria-hidden />
      {children}
    </p>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* ── Hero ── */}
      <section className="border-b border-border bg-muted/30 pt-20">
        <div className="mx-auto w-full max-w-8xl px-5 pb-10 pt-10 sm:px-6 lg:px-8 lg:pb-12 lg:pt-14">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
              <BookOpen weight="bold" className="size-3.5" /> Docs
            </Badge>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-foreground">Setup Guide</span>
            <Badge variant="secondary" className="ml-1">
              Beginner-friendly
            </Badge>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.35fr_0.75fr] lg:items-end">
            <div>
              <h1 className="text-balance text-4xl font-black leading-[0.95] tracking-tighter text-foreground sm:text-5xl lg:text-[3.6rem]">
                Set up OpenInstaDM
                <span className="block font-light tracking-tighter text-muted-foreground">
                  step by step.
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                This is the only guide you need. Follow it top to bottom — even if
                you&apos;ve never touched Postgres, Redis, or a Meta app before.
                Real time: <strong className="font-semibold text-foreground">~30 minutes</strong>,
                mostly waiting on Meta&apos;s dashboard.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#step-1"
                  className={cn(buttonVariants({ size: "lg" }), "gap-2")}
                >
                  Start setup <ArrowRight weight="bold" className="size-4" />
                </a>
                <a
                  href="https://github.com/xeven777/OpenInstaDM"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  View on GitHub
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-medium">
                  <Clock weight="bold" className="size-3.5" /> ~30 min
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-medium">
                  <ListChecks weight="bold" className="size-3.5" /> 6 steps
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-medium">
                  <Wrench weight="bold" className="size-3.5" /> No Docker required
                </span>
              </div>
            </div>

            {/* Right — What you're building */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lightning weight="fill" className="size-4 text-primary" />
                  What you&apos;re building
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Globe weight="bold" className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Web app</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Dashboard, auth, OAuth callback, webhooks. Runs on{" "}
                        <InlineCode>Vercel</InlineCode>.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <PlugsConnected weight="bold" className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Worker</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Queue + DMs + polling reconciler. Always-on host
                        (Railway/VM). <InlineCode>npm run worker</InlineCode>.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Database weight="bold" className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Postgres + Redis</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Same <InlineCode>DATABASE_URL</InlineCode> &{" "}
                        <InlineCode>REDIS_URL</InlineCode> &{" "}
                        <InlineCode>ENCRYPTION_KEY</InlineCode> in both processes.
                      </p>
                    </div>
                  </div>
                </div>
                <Alert className="border-amber-500/20 bg-amber-500/10">
                  <WarningCircle weight="fill" className="size-4 text-amber-600" />
                  <AlertTitle className="text-amber-900 dark:text-amber-100">
                    Encryption key must match
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-100/80">
                    The web app encrypts the Instagram token, the worker decrypts
                    it. Different keys → every DM fails with{" "}
                    <InlineCode>Failed to decrypt</InlineCode>.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="mx-auto grid w-full max-w-8xl gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-10 lg:px-8 lg:py-10">
        {/* TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                On this page
              </p>
              <nav className="mt-3 space-y-1">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-muted"
                  >
                    {item.step ? (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold tracking-widest text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                        {item.step}
                      </span>
                    ) : (
                      <span className="size-6 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium text-muted-foreground group-hover:text-foreground">
                      {item.label}
                    </span>
                  </a>
                ))}
              </nav>
            </div>

            <Card className="bg-muted/40">
              <CardContent className="space-y-3">
                <p className="text-sm font-semibold">Need help?</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Stuck on Meta&apos;s dashboard? See Troubleshooting or open an
                  issue on GitHub.
                </p>
                <Link
                  href="https://github.com/xeven777/OpenInstaDM/issues"
                  target="_blank"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
                >
                  Open an issue
                </Link>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 space-y-12">
          {/* Mobile TOC */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {toc.map((i) => (
              <a
                key={i.id}
                href={`#${i.id}`}
                className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium whitespace-nowrap"
              >
                {i.label}
              </a>
            ))}
          </div>

          {/* Overview */}
          <section id="overview" className="scroll-mt-24">
            <SectionLabel icon={BookOpen}>Start here</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              How OpenInstaDM works
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Someone comments a keyword like <InlineCode>LINK</InlineCode> on your
              reel → Meta sends a webhook → your app matches the keyword → the
              worker sends the DM via Meta&apos;s Private Reply API. No scraping,
              no password, no browser.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-5">
              {[
                ["Comment", "LINK on your post"],
                ["Webhook", "Meta → /api/webhook"],
                ["Match", "Keyword check"],
                ["Queue", "BullMQ job"],
                ["DM", "Private reply sent"],
              ].map(([title, desc], idx) => (
                <div key={title} className="relative">
                  <Card className="h-full">
                    <CardContent className="gap-2 py-4">
                      <span className="text-xs font-bold tracking-widest text-primary">
                        0{idx + 1}
                      </span>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </CardContent>
                  </Card>
                  {idx < 4 && (
                    <span className="absolute -right-2 top-1/2 hidden size-5 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground sm:flex">
                      <ArrowRight weight="bold" className="size-3" />
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="py-4">
                  <p className="text-sm font-semibold">Official API only</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Uses Instagram Private Replies. Personal accounts won&apos;t
                    work — switch to Business/Creator first.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm font-semibold">One reply per match</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Deduped by comment ID. Rate-limited to Meta&apos;s 750/hr cap.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm font-semibold">Two processes</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Web app receives, worker sends. Both must run.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Prerequisites */}
          <section id="prerequisites" className="scroll-mt-24">
            <SectionLabel icon={ListChecks}>Before you start</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Prerequisites
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Create these free accounts first. The Meta app step is the longest —
              everything else is 2 minutes.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Instagram Business/Creator",
                  desc: "Personal accounts can’t use the API. Switch in Instagram: Settings → Account type → Switch to Professional.",
                  must: true,
                },
                {
                  title: "Facebook account",
                  desc: "Required to create a Meta developer app at developers.facebook.com.",
                  must: true,
                },
                {
                  title: "Resend account",
                  desc: "Sends magic-link login emails. Free tier covers dev. Get an API key at resend.com/api-keys.",
                  must: true,
                },
                {
                  title: "PostgreSQL & Redis",
                  desc: "Pick one: local install, Docker, or free cloud (Neon/Supabase + Upstash). Docker is optional.",
                  must: true,
                },
                {
                  title: "Node.js 20.19+ / 22.12+ / 24+",
                  desc: "Required by Prisma 7 & Next 16. Check with node -v. Use nvm if you’re on an older version.",
                  must: true,
                },
                {
                  title: "Public HTTPS URL (for webhooks)",
                  desc: "A tunnel like Cloudflare Tunnel, ngrok, or zrok — so Meta can reach your localhost.",
                  must: true,
                },
              ].map((p) => (
                <Card key={p.title} className="relative">
                  <CardContent className="gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle weight="fill" className="size-4 shrink-0 text-primary" />
                      <p className="text-sm font-semibold">{p.title}</p>
                      {p.must && (
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">{p.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Step 1 */}
          <section id="step-1" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <StepBadge n="01" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step 1 · 2 minutes
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Generate your environment secrets
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Four random strings protect sessions, encrypt tokens, and verify
              webhooks. Run these in your terminal — copy the outputs for the next
              step.
            </p>

            <CodeBlock
              title="Generate secrets"
              lang="bash"
              code={`# 1. NextAuth session secret
openssl rand -base64 32

# 2. Cron protection secret (token refresh)
openssl rand -base64 32

# 3. Encryption key — MUST be exactly 64 hex chars (32 bytes)
openssl rand -hex 32

# 4. Webhook verify token — Meta uses this to confirm it's you
openssl rand -hex 16`}
              className="mt-6"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Alert>
                <ShieldCheck weight="bold" className="size-4" />
                <AlertTitle>Save these safely</AlertTitle>
                <AlertDescription>
                  You&apos;ll paste them into <InlineCode>.env</InlineCode> next.
                  Keep the same <InlineCode>ENCRYPTION_KEY</InlineCode> in both
                  the web app and the worker — otherwise decrypt fails.
                </AlertDescription>
              </Alert>
              <Alert>
                <WarningCircle weight="bold" className="size-4" />
                <AlertTitle>ENCRYPTION_KEY = 64 hex</AlertTitle>
                <AlertDescription>
                  <InlineCode>openssl rand -hex 32</InlineCode> gives 64
                  characters. Don&apos;t use base64 here — it must be hex.
                </AlertDescription>
              </Alert>
            </div>
          </section>

          {/* Step 2 */}
          <section id="step-2" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <StepBadge n="02" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step 2 · 5 minutes
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Local development setup
            </h2>

            <div className="mt-6 space-y-6">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    A
                  </span>
                  Clone & install
                </h3>
                <CodeBlock
                  lang="bash"
                  code={`git clone https://github.com/xeven777/openinstadm.git
cd openinstadm
npm install`}
                  className="mt-3"
                />
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    B
                  </span>
                  Create your <InlineCode>.env</InlineCode>
                </h3>
                <CodeBlock lang="bash" code={`cp .env.example .env`} className="mt-3" />
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Open <InlineCode>.env</InlineCode> and paste the four secrets
                  you generated in Step 1. You&apos;ll fill the Meta keys in
                  Step 4.
                </p>
                <CodeBlock
                  title=".env — fill this now"
                  lang="env"
                  code={`NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<output of step 1 — #1>
CRON_SECRET=<output of step 1 — #2>
ENCRYPTION_KEY=<output of step 1 — #3 — 64 hex chars>
WEBHOOK_VERIFY_TOKEN=<output of step 1 — #4>

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/openinstadm
REDIS_URL=redis://localhost:6379

RESEND_API_KEY=re_xxx
EMAIL_FROM="OpenInstaDM <login@yourdomain.com>"

# you’ll add these in Step 4
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
FACEBOOK_APP_SECRET=
META_GRAPH_API_VERSION=v26.0`}
                  className="mt-3"
                />
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    C
                  </span>
                  Start PostgreSQL & Redis
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Pick one option per datastore. Docker is supported but{" "}
                  <strong className="text-foreground">not required</strong>.
                </p>

                <Tabs defaultValue="local" className="mt-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="local" className="flex-1">
                      Local install
                    </TabsTrigger>
                    <TabsTrigger value="cloud" className="flex-1">
                      Free cloud
                    </TabsTrigger>
                    <TabsTrigger value="docker" className="flex-1">
                      Docker
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="local" className="space-y-3 pt-2">
                    <CodeBlock
                      title="macOS"
                      lang="bash"
                      code={`brew install postgresql@16 redis
brew services start postgresql@16
redis-server --daemonize yes

createdb openinstadm
psql -c "ALTER USER postgres PASSWORD 'postgres';" `}
                    />
                    <CodeBlock
                      title="Ubuntu / Debian"
                      lang="bash"
                      code={`sudo apt install postgresql redis-server
sudo systemctl start postgresql
redis-server --daemonize yes

sudo -u postgres createdb openinstadm
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" `}
                    />
                    <p className="text-xs text-muted-foreground">
                      Keep the shipped <InlineCode>.env</InlineCode> values:{" "}
                      <InlineCode>
                        postgresql://postgres:postgres@localhost:5432/openinstadm
                      </InlineCode>{" "}
                      and <InlineCode>redis://localhost:6379</InlineCode>.
                    </p>
                  </TabsContent>

                  <TabsContent value="cloud" className="space-y-3 pt-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card>
                        <CardContent className="py-3">
                          <p className="text-sm font-semibold">Postgres — Neon / Supabase</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Free 0.5 GB, pooled connection. Copy the{" "}
                            <InlineCode>postgresql://...</InlineCode> URL.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="py-3">
                          <p className="text-sm font-semibold">Redis — Upstash / Aiven</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Serverless Redis. Copy the{" "}
                            <InlineCode>rediss://...</InlineCode> URL (needs TCP, not HTTP-only).
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    <CodeBlock
                      title=".env — cloud URLs"
                      lang="env"
                      code={`DATABASE_URL=postgresql://user:password@your-neon-host/dbname?sslmode=require
REDIS_URL=rediss://user:password@your-upstash-host:6379`}
                    />
                    <Alert>
                      <WarningCircle weight="bold" className="size-4" />
                      <AlertTitle>Use the pooler URL</AlertTitle>
                      <AlertDescription>
                        On Neon/Supabase pick the pooler/pooled endpoint (
                        <InlineCode>-pooler</InlineCode> host) +{" "}
                        <InlineCode>sslmode=require</InlineCode>. Prisma handles
                        pooled connections much better.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  <TabsContent value="docker" className="space-y-3 pt-2">
                    <CodeBlock
                      lang="bash"
                      code={`# uses docker-compose.yml in the repo root
docker-compose up -d   # Postgres :5432 + Redis :6379`}
                    />
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-xs font-semibold">Reset everything later</p>
                      <CodeBlock
                        lang="bash"
                        code={`docker-compose down -v
docker-compose up -d
npm run db:generate && npm run db:migrate`}
                        className="mt-2"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    D
                  </span>
                  Initialize the database
                </h3>
                <CodeBlock
                  lang="bash"
                  code={`npm run db:generate   # builds Prisma client to @/app/generated/prisma
npm run db:migrate    # applies prisma/migrations to your DB`}
                  className="mt-3"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  No Docker? Reset with{" "}
                  <InlineCode>dropdb openinstadm && createdb openinstadm</InlineCode>{" "}
                  then re-run the two commands.
                </p>
              </div>
            </div>
          </section>

          {/* Step 3 */}
          <section id="step-3" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <StepBadge n="03" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step 3 · 3 minutes
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Expose your localhost with a public HTTPS URL
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Instagram webhooks must reach your machine. You need one tunnel —
              all three options below do the same thing.{" "}
              <strong className="text-foreground">Cloudflare Tunnel</strong> is
              the most reliable free choice (stable URL, no session limits).
            </p>

            <Tabs defaultValue="cloudflare" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="cloudflare" className="flex-1">
                  Cloudflare — Recommended
                </TabsTrigger>
                <TabsTrigger value="zrok" className="flex-1">
                  zrok — Open source
                </TabsTrigger>
                <TabsTrigger value="ngrok" className="flex-1">
                  ngrok — Simplest
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cloudflare" className="space-y-3 pt-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Quick Tunnel — no account, URL changes on restart
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CodeBlock
                      title="Install cloudflared"
                      lang="bash"
                      code={`# macOS
brew install cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

# Windows: download from github.com/cloudflare/cloudflared/releases/latest`}
                    />
                    <CodeBlock
                      title="Start tunnel"
                      lang="bash"
                      code={`cloudflared tunnel --url http://localhost:3000
# copy the https://xxx.trycloudflare.com URL`}
                    />
                    <CodeBlock
                      title=".env"
                      lang="env"
                      code={`NEXTAUTH_URL=https://xxx.trycloudflare.com`}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Named Tunnel — stable URL, survives restarts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CodeBlock
                      lang="bash"
                      code={`cloudflared login
cloudflared tunnel create opendm-dev
cloudflared tunnel route dns opendm-dev dev.yourdomain.com`}
                    />
                    <CodeBlock
                      title="~/.cloudflared/config.yml"
                      lang="yaml"
                      code={`tunnel: opendm-dev
credentials-file: /home/<you>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: dev.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404`}
                    />
                    <CodeBlock
                      lang="bash"
                      code={`cloudflared tunnel run opendm-dev`}
                    />
                    <CodeBlock
                      lang="env"
                      code={`NEXTAUTH_URL=https://dev.yourdomain.com`}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="zrok" className="space-y-3 pt-2">
                <CodeBlock
                  lang="bash"
                  code={`# 1. Install from netfoundry.io/docs/zrok
# 2. Create account at myzrok.io and copy invite token
zrok invite          # verify email
zrok enable <your-account-token>
zrok share public http://localhost:3000
# → https://abc123.share.zrok.io`}
                />
                <CodeBlock lang="env" code={`NEXTAUTH_URL=https://abc123.share.zrok.io`} />
                <p className="text-xs text-muted-foreground">
                  Tip: <InlineCode>zrok reserve</InlineCode> gives you a fixed
                  URL. See{" "}
                  <a
                    href="https://netfoundry.io/docs/zrok/how-tos/shares/manage-reserved-names"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    reserved names
                  </a>
                  .
                </p>
              </TabsContent>

              <TabsContent value="ngrok" className="space-y-3 pt-2">
                <CodeBlock
                  lang="bash"
                  code={`brew install ngrok   # or download from ngrok.com/download
# free account at ngrok.com → copy authtoken
ngrok config add-authtoken <your-auth-token>
ngrok http 3000
# → https://1a2b-3c4d.ngrok-free.app`}
                />
                <CodeBlock
                  lang="env"
                  code={`NEXTAUTH_URL=https://1a2b-3c4d.ngrok-free.app`}
                />
              </TabsContent>
            </Tabs>

            <Alert className="mt-4">
              <WarningCircle weight="bold" className="size-4" />
              <AlertTitle>Keep the tunnel running</AlertTitle>
              <AlertDescription>
                Leave the tunnel command open in its own terminal. If the URL
                changes on restart, update <InlineCode>NEXTAUTH_URL</InlineCode>{" "}
                and the two Meta URLs in Step 4.
              </AlertDescription>
            </Alert>
          </section>

          {/* Step 4 */}
          <section id="step-4" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <StepBadge n="04" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step 4 · 15 minutes — the critical part
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Configure the Meta developer app
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Follow in order. The Instagram Graph API only works from a real Meta
              app — this is where most beginners get stuck.
            </p>

            <div className="mt-6 space-y-6">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </span>
                    Create the app
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
                  <ol className="list-decimal space-y-1 pl-5 text-foreground">
                    <li>
                      Go to{" "}
                      <a
                        href="https://developers.facebook.com/apps"
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline underline-offset-4"
                      >
                        developers.facebook.com/apps
                      </a>{" "}
                      → <strong>Create App</strong>.
                    </li>
                    <li>
                      App type: <strong>Business</strong> → Next.
                    </li>
                    <li>
                      Name + contact email → Use Cases screen → filter “All” →
                      select{" "}
                      <strong>Manage messaging and content on Instagram</strong>.
                    </li>
                  </ol>
                  <Alert variant="destructive" className="mt-3">
                    <WarningCircle weight="bold" className="size-4" />
                    <AlertTitle>Don&apos;t pick the wrong use case</AlertTitle>
                    <AlertDescription>
                      Do NOT select “Authenticate with Facebook Login” or
                      “Marketing API”. You need the Instagram product specifically.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      2
                    </span>
                    Copy your app keys into <InlineCode>.env</InlineCode>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        App Settings → Basic
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold">
                        FACEBOOK_APP_SECRET
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click Show next to App Secret.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Instagram → API Setup
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold">
                        INSTAGRAM_APP_ID
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Long number like 2036...
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Instagram → API Setup
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold">
                        INSTAGRAM_APP_SECRET
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click Show under Instagram App Secret.
                      </p>
                    </div>
                  </div>
                  <CodeBlock
                    title=".env"
                    lang="env"
                    code={`INSTAGRAM_APP_ID=2036xxxxxxxxxxx
INSTAGRAM_APP_SECRET=your-instagram-app-secret
FACEBOOK_APP_SECRET=your-facebook-app-secret
META_GRAPH_API_VERSION=v26.0`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      3
                    </span>
                    Add yourself as an Instagram Tester
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6">
                  <p className="text-muted-foreground">
                    In Development mode Meta only allows testers you authorize.
                  </p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>
                      In the Meta dashboard go to <strong>App Roles → Roles</strong>{" "}
                      → <strong>Instagram Testers</strong> → Add Testers → type your
                      Instagram username → Send invite.
                    </li>
                    <li className="font-medium">
                      On your phone (crucial): Instagram → Profile → Settings and
                      activity → Apps and websites → Tester Invites → Accept.
                    </li>
                  </ol>
                  <Alert>
                    <Terminal weight="bold" className="size-4" />
                    <AlertTitle>Common mistake</AlertTitle>
                    <AlertDescription>
                      If you skip the phone acceptance, connecting Instagram later
                      fails with “Insufficient Developer Role”. The invite must be
                      accepted inside the Instagram app.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/[0.03]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      4
                    </span>
                    Redirect URI & Webhook — use your tunnel URL
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6">
                  <div>
                    <p className="font-semibold">
                      Business login → Redirect URI
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      In <strong>Instagram → API Setup → Business login settings</strong>{" "}
                      add:
                    </p>
                    <CodeBlock
                      lang="text"
                      code={`<YOUR-TUNNEL-URL>/api/instagram/callback
# e.g. https://xxx.trycloudflare.com/api/instagram/callback`}
                      className="mt-2"
                    />
                  </div>
                  <Separator />
                  <div>
                    <p className="font-semibold">Configure Webhooks</p>
                    <p className="mt-1 text-muted-foreground">
                      In <strong>Instagram → Configure Webhooks</strong>:
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>
                        <strong>Callback URL</strong>:{" "}
                        <InlineCode>
                          &lt;YOUR-TUNNEL-URL&gt;/api/webhook
                        </InlineCode>
                      </li>
                      <li>
                        <strong>Verify Token</strong>: paste{" "}
                        <InlineCode>WEBHOOK_VERIFY_TOKEN</InlineCode> from Step 1
                      </li>
                      <li>Click Verify and Save → Subscribe to </li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="success">comments</Badge>
                      <Badge variant="success">messages</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      5
                    </span>
                    Go Live
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  <ol className="list-decimal space-y-1 pl-5 text-foreground">
                    <li>
                      <strong>App Settings → Basic</strong>: set Privacy, Terms,
                      and Data Deletion URLs to{" "}
                      <InlineCode>
                        &lt;YOUR-TUNNEL-URL&gt;/privacy
                      </InlineCode>{" "}
                      etc.
                    </li>
                    <li>
                      Flip App Mode from <Badge variant="warning">Development</Badge>{" "}
                      to <Badge variant="success">Live</Badge> at the top of the
                      dashboard.
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Step 5 */}
          <section id="step-5" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <StepBadge n="05" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step 5 · 1 minute
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Start OpenInstaDM
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              You need <strong className="text-foreground">two terminals</strong>{" "}
              open at the same time. One receives, the other sends.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card className="overflow-hidden">
                <CardHeader className="bg-muted/40 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Terminal weight="bold" className="size-4" /> Terminal 1 — Web app
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <CodeBlock lang="bash" code={`npm run dev`} />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Serves the dashboard at{" "}
                    <InlineCode>http://localhost:3000</InlineCode> (your tunnel
                    forwards to it) and receives Meta webhooks.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">http://localhost:3000</Badge>
                    <Badge variant="outline">Turbopack</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-primary/20">
                <CardHeader className="bg-primary/[0.06] py-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <PlugsConnected weight="bold" className="size-4 text-primary" />{" "}
                    Terminal 2 — Worker
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <CodeBlock lang="bash" code={`npm run worker`} />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Long-running BullMQ worker. Sends DMs, button messages,
                    public replies, and runs the comment polling reconciler.
                  </p>
                  <Alert className="border-primary/15 bg-primary/[0.04] py-2">
                    <AlertDescription className="text-xs">
                      If this isn&apos;t running, webhooks are logged but{" "}
                      <strong>no DM ever sends</strong>.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Verify everything is healthy</p>
                  <p className="text-xs text-muted-foreground">
                    Open this in your browser after both processes start.
                  </p>
                </div>
                <CodeBlock
                  lang="bash"
                  code={`open https://<your-tunnel-url>/api/health
# expect: { worker: { healthy: true }, db: ok, redis: ok }`}
                  className="sm:min-w-[36ch]"
                />
              </CardContent>
            </Card>

            <Alert className="mt-4">
              <CheckCircle weight="fill" className="size-4 text-primary" />
              <AlertTitle>Try it end-to-end</AlertTitle>
              <AlertDescription>
                Connect Instagram in the dashboard → create a campaign for a post
                → comment your keyword from a tester account → watch the DM log.
                If it says “queued” but never “sent”, check Terminal 2.
              </AlertDescription>
            </Alert>
          </section>

          {/* Step 6 */}
          <section id="step-6" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <StepBadge n="06" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step 6 · Production
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Deploy to production
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              When you&apos;re ready to go live for real, split your hosting:{" "}
              <strong className="text-foreground">Vercel</strong> for the web app,
              an always-on host for the worker.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Cloud weight="bold" className="size-4" /> Railway — DB, Redis, Worker
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6">
                  <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>
                      <span className="text-foreground">
                        New Project → Add PostgreSQL + Redis.
                      </span>
                    </li>
                    <li>
                      Import repo → set{" "}
                      <InlineCode>NIXPACKS_BUILD_CMD=npm run db:generate</InlineCode>{" "}
                      and{" "}
                      <InlineCode>NIXPACKS_START_CMD=npm run worker</InlineCode>.
                    </li>
                    <li>Add all env vars — use Railway&apos;s internal hostnames.</li>
                  </ol>
                  <CodeBlock
                    lang="env"
                    code={`# Railway internal (worker)
DATABASE_URL=postgresql://postgres:xxx@postgres.railway.internal:5432/railway
REDIS_URL=redis://default:xxx@redis.railway.internal:6379`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Globe weight="bold" className="size-4" /> Vercel — Web app
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6">
                  <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>
                      <span className="text-foreground">Import GitHub repo into Vercel.</span>
                    </li>
                    <li>
                      Add all env vars — use Railway&apos;s{" "}
                      <strong className="text-foreground">public proxy URLs</strong>{" "}
                      (<InlineCode>*.proxy.rlwy.net</InlineCode>).
                    </li>
                    <li>Deploy.</li>
                  </ol>
                  <CodeBlock
                    lang="env"
                    code={`# Vercel (public proxy)
DATABASE_URL=postgresql://postgres:xxx@postgres.proxy.rlwy.net:1234/railway
REDIS_URL=redis://default:xxx@redis.proxy.rlwy.net:1234`}
                  />
                  <Alert className="py-2">
                    <AlertDescription className="text-xs">
                      Internal URLs don&apos;t work from Vercel — it&apos;s outside
                      Railway&apos;s network. Use the proxy.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardContent className="space-y-3 py-4">
                <h3 className="text-sm font-semibold">Run migrations on production</h3>
                <CodeBlock
                  lang="bash"
                  code={`DATABASE_URL="postgresql://postgres:password@your-railway-proxy.rlwy.net:5432/railway" npm run db:migrate`}
                />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Self-host alternative</Badge>
                  <span className="text-xs leading-5 text-muted-foreground">
                    Own server? See{" "}
                    <Link
                      href="/docs#architecture"
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Dokploy guide
                    </Link>{" "}
                    in{" "}
                    <InlineCode>docs/deploy-dokploy.md</InlineCode> — two
                    applications (web + worker), same repo, different start commands,
                    internal hostnames, and a <InlineCode>nixpacks.toml</InlineCode>{" "}
                    pin for Node 22.13.1.
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="scroll-mt-24">
            <SectionLabel icon={Wrench}>Help</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Troubleshooting
            </h2>

            <div className="mt-6 grid gap-3">
              {[
                {
                  title: "Insufficient Developer Role when connecting Instagram",
                  cause:
                    "Account not added as Tester, or invite not accepted on the phone.",
                  fix: "Re-send tester invite in App Roles → Roles → Instagram Testers. On phone: Instagram → Settings → Apps and websites → Tester Invites → Accept. Then reconnect.",
                },
                {
                  title: "Webhook verification fails",
                  cause:
                    "WEBHOOK_VERIFY_TOKEN mismatch, tunnel not running, or Meta still pointing at an old trycloudflare URL.",
                  fix: "Ensure the token in Meta’s webhook config exactly matches .env. Restart quick tunnels → update NEXTAUTH_URL and the two Meta URLs (callback + webhook). Prefer a named tunnel or reserved zrok share.",
                },
                {
                  title: "Comments logged but no DMs sent",
                  cause: "Worker not running or it crashed. Web app queues, worker sends.",
                  fix: "Check https://<your-domain>/api/health → worker.healthy must be true. In dev: npm run worker must stay open. In prod: check Railway/worker logs and restart. Also check /logs in the dashboard for FAILED with reason.",
                },
                {
                  title: "Decryption errors in the worker",
                  cause:
                    "ENCRYPTION_KEY in the web app doesn’t match the worker. Every encrypted token fails to decrypt.",
                  fix: "Set the identical 64-hex ENCRYPTION_KEY in both environments. Regenerate with openssl rand -hex 32 and update both sides, then re-connect the Instagram account to re-encrypt its token.",
                },
                {
                  title: "Prisma: Can't reach database / P1001",
                  cause:
                    "DATABASE_URL wrong, DB not started, or migrations tried during Docker build (Dokploy — build has no network).",
                  fix: "Verify PG is running (pg_isready / docker ps). Use pooler URL with sslmode=require on Neon. On Dokploy: prisma generate at build, prisma migrate deploy at start — not during build.",
                },
                {
                  title: "Redis / BullMQ: job not processed",
                  cause:
                    "REDIS_URL is HTTP-only (e.g. Upstash REST) — BullMQ needs native Redis TCP. Or Redis not reachable from Vercel.",
                  fix: "Use Redis Cloud, Upstash Redis with rediss:// TCP, or Aiven. From Vercel use the public proxy URL; from Railway/Dokploy use the internal hostname.",
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm leading-6">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs">
                      <span className="font-semibold text-destructive">Cause: </span>
                      <span className="text-muted-foreground">{item.cause}</span>
                    </p>
                    <p className="text-xs">
                      <span className="font-semibold text-primary">Fix: </span>
                      <span className="text-muted-foreground">{item.fix}</span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Env reference */}
          <section id="env" className="scroll-mt-24">
            <SectionLabel icon={Terminal}>Reference</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Environment variables
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Copy from <InlineCode>.env.example</InlineCode>. Never commit real
              values — set them in your host&apos;s env settings in production.
            </p>

            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Variable</th>
                      <th className="px-4 py-3 text-left font-semibold">Required</th>
                      <th className="px-4 py-3 text-left font-semibold">Example / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["NEXTAUTH_URL", "Yes", "https://xxx.trycloudflare.com — must be public HTTPS"],
                      ["NEXTAUTH_SECRET", "Yes", "openssl rand -base64 32 — session signing"],
                      ["CRON_SECRET", "Yes", "openssl rand -base64 32 — /api/cron/* bearer"],
                      ["ENCRYPTION_KEY", "Yes", "64 hex chars — openssl rand -hex 32 — same in web+worker"],
                      ["DATABASE_URL", "Yes", "postgresql://... Neon pooler recommended"],
                      ["REDIS_URL", "Yes", "redis:// or rediss:// — must be TCP for BullMQ"],
                      ["RESEND_API_KEY", "Yes", "re_... — magic-link emails"],
                      ["EMAIL_FROM", "Yes", "OpenInstaDM <login@yourdomain.com>"],
                      ["INSTAGRAM_APP_ID", "Yes", "Long numeric — Instagram → API Setup"],
                      ["INSTAGRAM_APP_SECRET", "Yes", "Instagram App Secret (Show)"],
                      ["FACEBOOK_APP_SECRET", "Yes", "App Settings → Basic → App Secret"],
                      ["WEBHOOK_VERIFY_TOKEN", "Yes", "openssl rand -hex 16 — paste in Meta webhook config"],
                      ["META_GRAPH_API_VERSION", "No", "v26.0 — default in .env.example"],
                    ].map(([name, req, note]) => (
                      <tr key={name} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{name}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={req === "Yes" ? "destructive" : "secondary"} className="text-[10px]">
                            {req === "Yes" ? "Required" : "Optional"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Alert className="mt-4">
              <ShieldCheck weight="bold" className="size-4" />
              <AlertTitle>Tip — keep both envs in sync</AlertTitle>
              <AlertDescription>
                In Railway, Vercel, and Dokploy you set envs in the dashboard.
                After changing <InlineCode>DATABASE_URL</InlineCode>,{" "}
                <InlineCode>REDIS_URL</InlineCode>, or{" "}
                <InlineCode>ENCRYPTION_KEY</InlineCode>, redeploy both the web
                app and the worker.
              </AlertDescription>
            </Alert>
          </section>

          {/* Architecture */}
          <section id="architecture" className="scroll-mt-24">
            <SectionLabel icon={Database}>Under the hood</SectionLabel>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Architecture in 30 seconds
            </h2>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardContent className="space-y-3 py-5">
                  <p className="font-mono text-xs leading-6 text-muted-foreground">
                    <span className="font-semibold text-foreground">[Comment]</span>
                    <br />
                    &nbsp;&nbsp;↓ webhook POST /api/webhook (HMAC verified)
                    <br />
                    &nbsp;&nbsp;↓ enqueue BullMQ → <span className="text-primary">dm-processing</span>
                    <br />
                    &nbsp;&nbsp;↓ worker/dm-worker.ts → lib/queue/dm-worker.ts
                    <br />
                    &nbsp;&nbsp;↙ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↘
                    <br />
                    processComment &nbsp; processPostback &nbsp; processMessage
                    <br />
                    &nbsp;&nbsp;↓ Meta Graph API (private/public reply, buttons, follow gate)
                  </p>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold">Stack</p>
                      <p className="mt-1 leading-5 text-muted-foreground">
                        Next.js 16 / React 19 · Prisma 7 + Postgres · BullMQ 5 + Redis · Auth.js
                        (Resend) · Tailwind 4
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold">Free production</p>
                      <p className="mt-1 leading-5 text-muted-foreground">
                        Vercel (web) · Neon (Postgres) · Redis Cloud · Oracle VM / Railway (worker)
                        · Resend · Meta
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Card>
                  <CardContent className="py-4">
                    <p className="text-sm font-semibold">Key files</p>
                    <ul className="mt-2 space-y-1.5 font-mono text-xs">
                      <li>
                        <span className="text-muted-foreground">app/api/webhook/route.ts</span> — verify & enqueue
                      </li>
                      <li>
                        <span className="text-muted-foreground">worker/dm-worker.ts</span> — lifecycle + polling
                      </li>
                      <li>
                        <span className="text-muted-foreground">lib/queue/dm-worker.ts</span> — match → send
                      </li>
                      <li>
                        <span className="text-muted-foreground">lib/meta/client.ts</span> — Graph API
                      </li>
                      <li>
                        <span className="text-muted-foreground">prisma/schema.prisma</span> — DB schema
                      </li>
                      <li>
                        <span className="text-muted-foreground">docs/stack.md</span> — full stack
                      </li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-primary/15 bg-primary/[0.04]">
                  <CardContent className="py-4">
                    <p className="text-sm font-semibold">Dokploy self-hosting?</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Same repo, two Dokploy Applications (web + worker), internal hostnames,
                      and start-command migrations. See{" "}
                      <InlineCode>docs/deploy-dokploy.md</InlineCode> for the three gotchas
                      (Node pin, build/start split, tunnel).
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <Card className="overflow-hidden">
            <CardContent className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent" aria-hidden />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  You&apos;re ready
                </p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight">
                  Create your first campaign
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Connect your Instagram, pick a reel, set a keyword like{" "}
                  <InlineCode>LINK</InlineCode>, and comment it to watch the DM
                  arrive. Every send is logged in <InlineCode>/logs</InlineCode>.
                </p>
              </div>
              <div className="relative flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/login"
                  className={cn(buttonVariants({ size: "lg" }), "justify-center gap-2")}
                >
                  Open dashboard <ArrowRight weight="bold" className="size-4" />
                </Link>
                <Link
                  href="/templates"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "justify-center")}
                >
                  Browse templates
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="pb-6 text-center text-xs text-muted-foreground">
            This guide mirrors{" "}
            <InlineCode>SETUP.md</InlineCode> and{" "}
            <InlineCode>docs/stack.md</InlineCode>. If Meta&apos;s dashboard changes,
            a PR documenting the new flow helps everyone.
          </p>
        </div>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-8xl items-center justify-between px-5 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <span className="font-semibold tracking-tight text-foreground">OpenInstaDM</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="transition hover:text-foreground">
              Home
            </Link>
            <Link href="/templates" className="transition hover:text-foreground">
              Templates
            </Link>
            <a
              href="https://github.com/xeven777/OpenInstaDM"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
