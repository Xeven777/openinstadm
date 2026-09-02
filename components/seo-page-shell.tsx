import Link from "next/link";
import Navbar from "@/components/sections/navbar";
import Footer from "@/components/sections/footer";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ArrowRightIcon,
  SparkleIcon,
} from "@phosphor-icons/react/dist/ssr";

export interface SeoPageSection {
  title: string;
  body: string;
}

export interface SeoPageConfig {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta?: string;
  bullets: string[];
  sections: SeoPageSection[];
  comparisonTitle: string;
  comparisons: Array<{
    label: string;
    ours: string;
    other: string;
  }>;
  templateLinks: Array<{
    label: string;
    href: string;
  }>;
  faqs: SeoPageSection[];
}

export default function SeoPageShell({ config }: { config: SeoPageConfig }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="mx-auto grid w-full max-w-8xl gap-10 px-5 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pt-32">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary shadow-sm">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              {config.eyebrow}
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[0.95] tracking-tighter text-foreground sm:text-5xl lg:text-[3.25rem]">
              {config.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {config.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "glow", size: "lg" }),
                  "rounded-full px-7 h-11 btn-shadow2 gap-2",
                )}
              >
                {config.primaryCta}
                <ArrowRightIcon weight="bold" className="size-4" />
              </Link>
              <Link
                href="/templates"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full px-7 h-11 bg-background",
                )}
              >
                {config.secondaryCta ?? "Browse templates"}
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <SparkleIcon weight="duotone" className="size-3.5 text-primary" />
                Official Meta API
              </span>
              <span className="h-3 w-px bg-border" />
              <span>No credit card required</span>
              <span className="h-3 w-px bg-border" />
              <span>Open source</span>
            </div>
          </div>

          {/* Checklist card - app window style */}
          <div className="overflow-hidden rounded-xl border border-border bg-card app-window-glow lg:mt-2">
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                Campaign OS — checklist
              </span>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                What you get
              </p>
              <ul className="mt-4 space-y-4">
                {config.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckIcon weight="bold" className="size-3" />
                    </span>
                    <span className="text-foreground/80">{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-foreground">
                  Live queue · Rate-limited · Logged
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Webhooks catch comments instantly + polling reconciliation so
                  nothing slips through.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value props - 3 cards */}
      <section className="mx-auto w-full max-w-8xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {config.sections.map((section, i) => (
            <Card
              key={section.title}
              className="rounded-2xl border-border bg-card p-0 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group"
            >
              <CardContent className="p-6 sm:p-7">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold">
                  0{i + 1}
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {section.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="border-y border-border bg-muted/30 py-16">
        <div className="mx-auto w-full max-w-8xl px-5 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Comparison
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tighter text-foreground sm:text-4xl">
              {config.comparisonTitle}
            </h2>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="hidden grid-cols-[0.9fr_1fr_1fr] border-b border-border bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid">
              <div className="px-5 py-3">Need</div>
              <div className="px-5 py-3 flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                OpenInstaDM
              </div>
              <div className="px-5 py-3">Generic automation</div>
            </div>
            {config.comparisons.map((item) => (
              <div
                key={item.label}
                className="grid gap-0 border-b border-border last:border-0 md:grid-cols-[0.9fr_1fr_1fr]"
              >
                <div className="bg-muted/20 px-5 py-4 text-sm font-semibold text-foreground md:bg-muted/20">
                  {item.label}
                </div>
                <div className="border-t border-border px-5 py-4 text-sm leading-6 text-foreground/80 md:border-t-0 md:border-l">
                  {item.ours}
                </div>
                <div className="px-5 pb-4 pt-0 text-sm leading-6 text-muted-foreground md:border-l md:py-4 md:border-border">
                  <span className="inline md:hidden text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Generic automation —{" "}
                  </span>
                  {item.other}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Template links */}
      <section className="mx-auto grid w-full max-w-8xl gap-8 px-5 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Start from a template
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tighter text-foreground sm:text-4xl">
            Launch faster than
            <br />
            building a chatbot flow
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Use a campaign template, connect the right Instagram account, pick
            the post, and ship a measurable comment-to-DM loop. Clone the same
            playbook across client accounts.
          </p>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-6 rounded-full",
            )}
          >
            Explore all templates <ArrowRightIcon className="ml-1 size-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {config.templateLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex items-center justify-between rounded-xl border border-border bg-card p-5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-md"
            >
              <span className="pr-4 leading-6">{link.label}</span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRightIcon className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/20 py-16">
        <div className="mx-auto grid w-full max-w-8xl gap-8 px-5 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tighter text-foreground sm:text-4xl">
              Search questions,
              <br />
              answered clearly
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Everything you need to know before launching your first
              comment-to-DM campaign.
            </p>
          </div>
          <div className="grid gap-3">
            {config.faqs.map((faq) => (
              <Card
                key={faq.title}
                className="rounded-xl border-border bg-card p-0 shadow-sm"
              >
                <CardContent className="p-6">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {faq.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {faq.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - matches Cta.tsx */}
      <section>
        <div className="mx-auto w-full max-w-8xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-border px-6 py-14 sm:p-12 lg:p-14 bg-black text-center">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-48 w-96 blur-[80px] rounded-full bg-primary opacity-60 pointer-events-none" />
            <div className="relative flex flex-col items-center">
              <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tighter sm:text-4xl lg:text-5xl text-white">
                Turn the next high-intent
                <br />
                comment into a private reply
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                OpenInstaDM is built for Instagram professional accounts,
                official Meta private replies, and campaign reporting teams can
                show clients.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "glow", size: "lg" }),
                    "rounded-full px-7 h-11 btn-shadow2",
                  )}
                >
                  Start free <ArrowRightIcon className="ml-1 size-4" weight="bold" />
                </Link>
                <a
                  href="https://github.com/xeven777/OpenInstaDM"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "rounded-full h-11 px-7 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white",
                  )}
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
