"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  ChatCircleDotsIcon,
  GithubLogoIcon,
  HardDrivesIcon,
  LifebuoyIcon,
  LockKeyIcon,
  PlusIcon,
  QueueIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";

const faqs = [
  {
    question: "What exactly does OpenInstaDM do?",
    answer:
      "Someone comments your keyword (like \u201cLINK\u201d) on a post or reel, and a second later they get a DM with your link \u2014 through Meta's official private replies API. You can also post a public comment reply at the same time, and personalize the message with {username}.",
    icon: <ChatCircleDotsIcon weight="duotone" className="size-4" />,
  },
  {
    question: "Is it really free? What's the catch?",
    answer:
      "There is no catch. It's MIT-licensed open source with no billing layer, no seat limits, and no plan caps. The whole stack runs on free tiers: Vercel for the web app, Neon for Postgres, Redis Cloud for the queue, an Oracle Cloud always-free VM for the worker, and Resend for login emails.",
    icon: <BookOpenIcon weight="duotone" className="size-4" />,
  },
  {
    question: "Is this safe for my Instagram account?",
    answer:
      "Yes. OpenInstaDM is built entirely around Meta's official Instagram API with Instagram Login. It does not scrape, it does not automate a browser, and it never asks for your Instagram password. Private replies are the sanctioned way to DM from a comment, which keeps you inside Meta's rules.",
    icon: <LockKeyIcon weight="duotone" className="size-4" />,
  },
  {
    question: "What do I need to run it?",
    answer:
      "A Meta developer app, a Resend account for login emails, and somewhere to host Postgres and Redis alongside the two processes. The Instagram account you connect has to be a Business or Creator account \u2014 personal accounts don't support the API. The code deploys in minutes; the Meta app setup is the part that takes real time, and the setup guide walks you through it.",
    icon: <HardDrivesIcon weight="duotone" className="size-4" />,
  },
  {
    question: "Why are there two processes to run?",
    answer:
      "The web app serves the dashboard and receives webhooks; a separate background worker does the sending, because sends have to survive rate limits and retries \u2014 that's what BullMQ on Redis is for. Both share the same Postgres, Redis, and encryption key. If comments come in and no DM ever arrives, the worker is the first thing to check.",
    icon: <QueueIcon weight="duotone" className="size-4" />,
  },
  {
    question: "What if Instagram doesn't send a webhook?",
    answer:
      "Webhooks are the primary path, but Meta sometimes filters comments out of webhook delivery. A polling reconciler sweeps recent comments as a safety net and catches anything the webhook missed. Your own comments are filtered too, since Meta rejects DMing yourself.",
    icon: <LifebuoyIcon weight="duotone" className="size-4" />,
  },
  {
    question: "Will I hit Instagram's rate limits?",
    answer:
      "Per-account rate limiting keeps you under Meta's documented cap of 750 private replies per hour. The overflow isn't dropped \u2014 it's queued and sent as soon as the window frees up. Every send, skip, and failure is logged with a reason, so nothing disappears into a black box.",
    icon: <QueueIcon weight="duotone" className="size-4" />,
  },
  {
    question: "Can I connect multiple accounts or run this for clients?",
    answer:
      "Yes. Connect several professional Instagram accounts under one workspace, each with its own rate limits. Workspace owners can grant members scoped access to automations, Instagram accounts, or team management \u2014 useful if you run this for clients.",
    icon: <UsersThreeIcon weight="duotone" className="size-4" />,
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq">
      <div className="mx-auto w-full max-w-8xl px-5 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Left — sticky intro */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              FAQ
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-5%] text-transparent bg-clip-text bg-linear-to-br from-foreground/80 to-primary via-foreground sm:text-5xl">
              Questions,
              <br />
              answered
            </h2>
            <p className="mt-6 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              The things people actually ask before self-hosting their first
              comment-to-DM campaign. Something missing? The setup guide and
              the repo have the rest.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link
                href="/docs"
                className={cn(
                  buttonVariants({ variant: "glow", size: "lg" }),
                  "rounded-full px-6 h-11 btn-shadow2",
                )}
              >
                Read the docs
                <BookOpenIcon className="ml-2 size-4" weight="bold" />
              </Link>
              <a
                href="https://github.com/xeven777/OpenInstaDM"
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "justify-center rounded-full px-6 h-11",
                )}
              >
                <GithubLogoIcon className="mr-2 size-4" weight="fill" />
                Ask on GitHub
                <ArrowUpRightIcon className="ml-1 size-3.5" weight="bold" />
              </a>
            </div>
          </div>

          {/* Right — accordion */}
          <div className="flex flex-col gap-3">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              return (
                <div
                  key={faq.question}
                  className={cn(
                    "group rounded-2xl border bg-card transition-all duration-300",
                    open
                      ? "border-primary/30 shadow-lg faq-card-active"
                      : "border-border hover:border-primary/20 hover:shadow-sm",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    aria-expanded={open}
                    aria-controls={`faq-answer-${index}`}
                    id={`faq-question-${index}`}
                    className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-6 sm:py-5"
                  >
                    <span
                      className={cn(
                        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                        open
                          ? "gradient-glow [--glow-color:var(--primary)] text-black"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary",
                      )}
                    >
                      {faq.icon}
                    </span>
                    <span className="flex-1 text-[15px] font-semibold leading-snug tracking-tight text-foreground sm:text-base">
                      {faq.question}
                    </span>
                    <PlusIcon
                      weight="bold"
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:text-foreground",
                        open && "rotate-45 text-primary",
                      )}
                    />
                  </button>

                  <div
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      open
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-6 text-muted-foreground sm:px-6 sm:pb-6 lg:pr-14">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
