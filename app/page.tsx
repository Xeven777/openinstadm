import type { ReactNode } from "react";
import Link from "next/link";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Hero from "@/components/sections/hero";
import Navbar from "@/components/sections/navbar";
import FeaturesSection from "@/components/sections/features";
import HowWorks from "@/components/sections/how-works";

const GITHUB_URL = "https://github.com/xeven777/OpenInstaDM";

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
    <main>
      <Navbar />
      <Hero />
      <FeaturesSection />
      <HowWorks />

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

