import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/sections/navbar";
import Footer from "@/components/sections/footer";
import ExamplesNichePicker from "@/components/examples-niche-picker";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ArrowRightIcon,
  SparkleIcon,
} from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Instagram Comment-to-DM Setup Guide — Launch Your First Campaign",
  description:
    "Set up Instagram comment-to-DM in about 15 minutes: connect your account, pick a post, set keywords, write the DM with a tracked link, and test it. With copy-paste examples for 8 niches.",
  alternates: { canonical: "/instagram-comment-to-dm-examples" },
  openGraph: {
    title: "Instagram Comment-to-DM Setup Guide — Launch Your First Campaign",
    description:
      "A step-by-step guide plus copy-paste keyword and DM examples for creators, shops, coaches, and local businesses.",
    url: "/instagram-comment-to-dm-examples",
  },
};

const prerequisites = [
  {
    title: "A professional Instagram account",
    body: "Business or Creator — personal accounts don't support Meta's messaging API.",
  },
  {
    title: "One post or reel",
    body: "Anything with a clear comment prompt, e.g. “Comment LINK and I'll send it”.",
  },
  {
    title: "A destination link",
    body: "Product page, booking form, lead magnet, or waitlist — it becomes a tracked link.",
  },
];

const steps = [
  {
    time: "~2 min",
    where: "/settings",
    title: "Connect your Instagram account",
    body: "Sign in, open Settings, and hit Connect Instagram. You'll go through Meta's OAuth flow — no passwords, tokens are encrypted at rest. One workspace can hold several client accounts.",
    tip: "If the button says the account is already connected elsewhere, disconnect it in the other workspace first.",
  },
  {
    time: "~2 min",
    where: "/campaigns/new",
    title: "Create a campaign and pick the post",
    body: "Open the campaign builder, choose the Instagram account, then scope the trigger: a specific post, any post, or the next post you publish. New to this? Start with one specific reel.",
    tip: "Scoping to one post keeps replies precise — every match gets the reply tied to that post.",
  },
  {
    time: "~2 min",
    where: "/campaigns/new",
    title: "Set your keywords",
    body: "Add up to 10 keywords and choose the match mode: specific words (only these trigger) or any word (every comment triggers). Start with one obvious keyword like LINK and add fallbacks like SHOP or GUIDE later.",
    tip: "Whole-word matching avoids misfires — “send guide” won't trigger on a stray “guide” mention unless you want it to.",
  },
  {
    time: "~3 min",
    where: "/campaigns/new",
    title: "Write the DM and attach your link",
    body: "Write the opening message and the link DM, then paste your destination URL. It's wrapped in a tracked short link automatically, so every campaign reports clicks and CTR — not just sends.",
    tip: "Keep the DM short and deliver exactly what the comment promised. One link, one promise.",
  },
  {
    time: "~3 min",
    where: "/campaigns/new",
    title: "Add the finishing touches (optional)",
    body: "Enable a short public reply so commenters know to check their inbox, turn on the follow gate to grow followers before delivering the link, or add a follow-up message sent minutes after the link.",
    tip: "Skip everything optional on your first campaign. Ship the simple loop, then layer on gates.",
  },
  {
    time: "~3 min",
    where: "/logs",
    title: "Go live and test it",
    body: "Flip the campaign active, then comment your keyword from a second account. Watch the Logs page: sent, skipped (with the reason — wrong keyword, cooldown, limit), failed, and rate-limited. Check the dashboard for tracked clicks.",
    tip: "Testing from a second account is the fastest way to confirm webhooks are reaching your workspace.",
  },
];

const faqs = [
  {
    title: "I commented the keyword but no DM arrived. Why?",
    body: "Check four things: the campaign is active, the comment is on the scoped post, the keyword matches the match mode, and the Logs page — every skip lists its reason (wrong keyword, cooldown, plan limit).",
  },
  {
    title: "Can I use a personal Instagram account?",
    body: "No. Meta's private replies API only works with Business or Creator (professional) accounts. Switch the account type in Instagram settings first — it's free.",
  },
  {
    title: "Will Instagram flag automatic DMs?",
    body: "Private replies are an official Meta feature for professional accounts. OpenInstaDM uses that endpoint keyed by comment ID, with queued, rate-limited delivery — no scraping or browser automation.",
  },
  {
    title: "Can I require people to follow me first?",
    body: "Yes. Enable the follow gate per campaign: the commenter gets a follow prompt first, and the link is delivered once they follow.",
  },
];

const relatedLinks = [
  {
    label: "Instagram Auto DM",
    body: "Replies the second they comment.",
    href: "/instagram-auto-dm",
  },
  {
    label: "Comment LINK automation",
    body: "LINK, SHOP, GUIDE → tracked DM.",
    href: "/comment-link-automation",
  },
  {
    label: "Keyword automation",
    body: "Exact and phrase matching, per-keyword stats.",
    href: "/instagram-keyword-automation",
  },
  {
    label: "Lead magnet automation",
    body: "GUIDE comments into leads on autopilot.",
    href: "/instagram-lead-magnet-automation",
  },
];

export default function CommentToDmExamplesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="mx-auto w-full max-w-8xl px-5 pb-16 pt-28 sm:px-6 lg:px-8 lg:pt-32">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary shadow-sm">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Setup guide · about 15 minutes
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[0.95] tracking-tighter sm:text-5xl lg:text-[3.25rem]">
              Launch your first comment-to-DM campaign
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Connect your Instagram account, pick a post, set one keyword,
              write the DM with a tracked link — then test it from a second
              account. Below: every step plus copy-paste examples for 8 niches.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "glow", size: "lg" }),
                  "rounded-full px-7 h-11 btn-shadow2 gap-2",
                )}
              >
                Start free
                <ArrowRightIcon weight="bold" className="size-4" />
              </Link>
              <Link
                href="/docs"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full px-7 h-11 bg-background",
                )}
              >
                Read the docs
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
        </div>
      </section>

      {/* Prerequisites */}
      <section className="mx-auto w-full max-w-8xl px-5 py-14 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Before you start
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-4xl">
          Three things you need
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {prerequisites.map((item, i) => (
            <Card key={item.title} className="rounded-2xl shadow-sm">
              <CardContent className="p-6 sm:p-7">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                  0{i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-border bg-muted/30 py-16">
        <div className="mx-auto w-full max-w-8xl px-5 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              The setup
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-4xl">
              Six steps to your first automated DM
            </h2>
          </div>
          <ol className="mt-10 grid gap-5 lg:grid-cols-2">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Card className="h-full rounded-2xl shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <Badge variant="secondary">{step.time}</Badge>
                      <code className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                        {step.where}
                      </code>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                    <p className="mt-4 flex gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                      <CheckIcon
                        weight="bold"
                        className="mt-0.5 size-3.5 shrink-0 text-primary"
                      />
                      {step.tip}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Niche examples */}
      <section className="mx-auto w-full max-w-8xl px-5 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Copy-paste examples
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tighter sm:text-4xl">
          Steal a starting setup for your niche
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          Pick your niche, copy the keywords and DM reply into the campaign
          builder, and follow the launch playbook. Swap in your own link —
          tracking and analytics come along automatically.
        </p>
        <div className="mt-8">
          <ExamplesNichePicker />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/20 py-16">
        <div className="mx-auto grid w-full max-w-8xl gap-8 px-5 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-4xl">
              Stuck? Start here
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              The most common first-campaign issues and how to fix them.
            </p>
          </div>
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <Card
                key={faq.title}
                className="rounded-xl border-border bg-card p-0 shadow-sm"
              >
                <CardContent className="p-6">
                  <h3 className="text-[15px] font-semibold">{faq.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {faq.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Related playbooks */}
      <section className="mx-auto w-full max-w-8xl px-5 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Keep exploring
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-4xl">
          Related playbooks
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex items-center justify-between rounded-xl border border-border bg-card p-5 text-sm font-medium shadow-sm transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-md"
            >
              <span className="pr-4 leading-6">
                {link.label}
                <span className="block text-xs font-normal text-muted-foreground">
                  {link.body}
                </span>
              </span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRightIcon className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto w-full max-w-8xl px-5 py-16 pt-0 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-black px-6 py-14 text-center sm:p-12 lg:p-14">
            <div className="pointer-events-none absolute -top-32 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-primary opacity-60 blur-[80px]" />
            <div className="relative flex flex-col items-center">
              <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tighter text-white sm:text-4xl lg:text-5xl">
                Your first campaign is
                <br />
                15 minutes away
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Copy an example above, paste it into the builder, and comment
                your keyword to watch the DM arrive.
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
