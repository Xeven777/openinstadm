import type { ReactNode } from "react";
import Link from "next/link";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Hero from "@/components/sections/hero";
import Navbar from "@/components/sections/navbar";

const GITHUB_URL = "https://github.com/xeven777/OpenInstaDM";

const heroStats = [
  { value: "24/7", label: "Comment monitoring" },
  { value: "<1s", label: "Reply latency" },
  { value: "0", label: "Scraping required" },
];

const flowSteps = [
  {
    number: "01",
    title: "Connect your Instagram",
    description:
      "Sign in by email and link your professional account once. No password sharing, no browser automation, no risk.",
  },
  {
    number: "02",
    title: "Set keywords and replies",
    description:
      "Create a campaign: pick a post, choose the keyword to watch, write the DM and optional public reply.",
  },
  {
    number: "03",
    title: "It runs itself",
    description:
      "Webhooks catch comments instantly. A polling sweep catches anything Instagram misses. Every send is queued, rate-limited, and logged.",
  },
];

const features = [
  {
    title: "Email magic-link sign-in",
    description: "No passwords. One tap from your email.",
  },
  {
    title: "Multiple Instagram accounts",
    description: "Connect several professional accounts under one workspace.",
  },
  {
    title: "Encrypted tokens at rest",
    description: "AES-256-GCM encryption. Your tokens never touch plaintext.",
  },
  {
    title: "Webhook + polling reconciliation",
    description:
      "Live webhooks plus a polling safety net. Nothing slips through.",
  },
  {
    title: "Queue-backed delivery",
    description:
      "BullMQ handles retries, rate limits, and overflow automatically.",
  },
  {
    title: "Tracked links with click stats",
    description:
      "Swap any link for a tracked redirect. See clicks and CTR per campaign.",
  },
  {
    title: "DM logs with full status",
    description: "Every send, skip, and failure is logged with a reason.",
  },
  {
    title: "Follow gate",
    description:
      "Optionally require a follow before handing over the link. Re-prompts until they do.",
  },
  {
    title: "Fully self-hosted",
    description: "No plan limits, no seat caps. You run it, you own it.",
  },
];

/* ─── App Preview Mocks ─── */

function AppWindow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-background app-window-glow",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

const overviewStats = [
  ["Views", "847.2K"],
  ["Reach", "612.4K"],
  ["Likes", "38.1K"],
  ["Comments", "4,204"],
  ["Saved", "9,712"],
  ["Shares", "2,340"],
];

const overviewPosts = [
  ["Spring drop reel", "214.8K", "9.1K", "Apr 3"],
  ["Restock haul", "88.4K", "5.2K", "Mar 28"],
  ["Behind the studio", "51.3K", "3.4K", "Mar 21"],
];

function OverviewPreview() {
  return (
    <AppWindow label="app / overview">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Overview</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Recent — 24 posts from @studio.store
          </p>
        </div>
        <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          Last 50
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {overviewStats.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">
            Followers over time
          </p>
          <p className="text-xs text-muted-foreground">
            48,210 <span className="font-medium text-success">+1,240</span> ·
            30d
          </p>
        </div>
        <svg
          viewBox="0 0 300 64"
          preserveAspectRatio="none"
          className="mt-3 h-16 w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="oklch(0.841 0.238 128.85)"
                stopOpacity="0.2"
              />
              <stop
                offset="100%"
                stopColor="oklch(0.841 0.238 128.85)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <path
            d="M0,54 L43,49 L86,51 L129,40 L171,36 L214,26 L257,20 L300,9 L300,64 L0,64 Z"
            fill="url(#chart-gradient)"
          />
          <polyline
            points="0,54 43,49 86,51 129,40 171,36 214,26 257,20 300,9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="text-primary"
          />
        </svg>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-semibold text-foreground">Posts</p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Post</th>
              <th className="pb-2 px-3 text-right font-medium">Views</th>
              <th className="pb-2 px-3 text-right font-medium">Likes</th>
              <th className="pb-2 pl-3 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {overviewPosts.map(([post, views, likes, date]) => (
              <tr key={post} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-3 font-medium text-foreground">
                  {post}
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  {views}
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  {likes}
                </td>
                <td className="py-2.5 pl-3 text-right text-muted-foreground">
                  {date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppWindow>
  );
}

function MatchedCommentCard() {
  return (
    <div className="w-64 rounded-xl border border-border bg-background p-4 app-window-glow animate-fade-in-up animate-delay-300">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          MC
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">@maya.co</p>
          <p className="text-[11px] text-muted-foreground">just now</p>
        </div>
      </div>
      <p className="mt-2.5 text-sm text-muted-foreground">LINK please</p>
      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
        <p className="text-[11px] font-medium text-muted-foreground">
          Matched keyword
        </p>
        <p className="mt-0.5 text-sm font-bold text-primary">LINK</p>
        <p className="mt-1 text-[11px] font-medium text-success">
          Private reply queued
        </p>
      </div>
    </div>
  );
}

const dashboardStats = [
  ["Active Campaigns", "8"],
  ["DMs Sent", "1,284"],
  ["Skipped", "42"],
  ["Failed", "3"],
  ["Clicks", "356"],
  ["CTR", "27.7%"],
];

const dashboardChart: [string, number][] = [
  ["Mon", 42],
  ["Tue", 68],
  ["Wed", 51],
  ["Thu", 94],
  ["Fri", 120],
  ["Sat", 86],
  ["Sun", 73],
];

const dashboardActivity = [
  ["@maya.co", "Product guide reply", "Sent", "text-success"],
  ["@founder.ray", "Price request", "Sent", "text-success"],
  ["@shop.ava", "Lead magnet", "Queued", "text-warning"],
];

function DashboardPreview() {
  const maxDM = Math.max(...dashboardChart.map(([, n]) => n));
  return (
    <AppWindow label="app / dashboard">
      <h3 className="text-base font-semibold text-foreground">Hello, Maya!</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        2 connected accounts · 340 contacts
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {dashboardStats.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-semibold text-foreground">
          DMs — Last 7 Days
        </p>
        <div className="mt-4 flex h-32 items-end gap-2">
          {dashboardChart.map(([day, n]) => (
            <div key={day} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground">
                {n}
              </span>
              <div
                className="w-full rounded-sm bg-primary/80 transition-all duration-500"
                style={{ height: `${Math.max((n / maxDM) * 100, 4)}%` }}
              />
              <span className="text-[10px] text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-semibold text-foreground">Recent Activity</p>
        <div className="mt-3 space-y-0">
          {dashboardActivity.map(([user, automation, status, color]) => (
            <div
              key={user}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
            >
              <span className="font-medium text-foreground">{user}</span>
              <span className="truncate text-muted-foreground">
                {automation}
              </span>
              <span className={`text-xs font-medium ${color}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

export default async function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />

      {/* ─── How it works ─── */}
      <section id="how">
        <div className="mx-auto w-full max-w-8xl px-5 py-24 sm:px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                How it works
              </p>
              <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tighter text-foreground sm:text-5xl">
                A comment in,
                <br />a DM out
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Three steps. Connect an account, build a campaign, and let it
                run. The webhook handles it live and the poll sweeps up whatever
                Instagram never pushes.
              </p>
            </div>

            <div className="grid gap-5">
              {flowSteps.map((step, i) => (
                <article
                  key={step.title}
                  className={cn(
                    "group relative rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-sm",
                    i === flowSteps.length - 1 &&
                      "border-primary/20 bg-primary/2",
                  )}
                >
                  <div className="flex items-start gap-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Dashboard ─── */}
      <section className="border-y border-border">
        <div className="mx-auto grid w-full max-w-8xl gap-12 px-5 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:items-center">
          <DashboardPreview />

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              The dashboard
            </p>
            <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tighter text-foreground sm:text-5xl">
              See exactly what
              <br />
              happened
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              Every comment event is traceable: queued, matched, sent, skipped,
              failed, or rate-limited. No black box.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              {[
                "Real-time activity feed",
                "Per-campaign click tracking",
                "Full DM logs with reasons",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    ✓
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="bg-muted/30">
        <div className="mx-auto w-full max-w-8xl px-5 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              What&rsquo;s included
            </p>
            <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tighter text-foreground sm:text-5xl">
              Everything,
              <br />
              no tiers
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              Self-hosted and open source. Nothing to unlock. You run it, you
              own it.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-background p-5 transition-all duration-200 hover:border-primary/25 hover:shadow-sm"
              >
                <h3 className="text-sm font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-8xl px-5 py-24 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-background p-8 sm:p-12 lg:p-16">
            <div className="hero-glow absolute inset-0 pointer-events-none opacity-50" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="max-w-2xl text-4xl font-bold leading-tight tracking-tighter text-foreground sm:text-5xl">
                  Turn your next reel&rsquo;s
                  <br />
                  comments into DMs
                </h2>
                <p className="mt-5 max-w-lg text-base text-muted-foreground">
                  Free and open source. Star it if it saves you a subscription.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col">
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "w-full justify-center px-7 sm:w-auto",
                  )}
                >
                  Get started free
                </Link>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full justify-center px-7 sm:w-auto",
                  )}
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-8xl items-center justify-between px-5 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <span className="font-semibold tracking-tight text-foreground">
            OpenInstaDM
          </span>
          <div className="flex items-center gap-4">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
            >
              <GithubLogo
                weight="fill"
                className="h-4 w-4"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
