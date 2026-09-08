"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  EnvelopeSimpleIcon,
  GithubLogoIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";
import { DM_Serif_Display } from "next/font/google";
import {
  detectCountryClientSide,
  getPricingForCountry,
  PRICING_BY_GROUP,
  type PricingInfo,
} from "@/lib/geo-pricing";

const SETUP_EMAIL = "hello@auradevs.co";
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  style: "italic",
  weight: "400",
});

function Check() {
  return (
    <span
      aria-hidden="true"
      className="flex size-5.5 shrink-0 items-center justify-center rounded-[7px] bg-primary text-primary-foreground"
    >
      <CheckIcon weight="bold" className="size-3.5" />
    </span>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition-colors",
        on ? "bg-primary" : "bg-muted border border-border",
      )}
    >
      <span
        className={cn(
          "size-5 rounded-full bg-white shadow-sm transition-all",
          on ? "ml-auto" : "mr-auto",
          !on && "border border-black/5 dark:border-white/10",
          on && "bg-primary-foreground",
        )}
      />
    </span>
  );
}

const selfHostedFeatures = [
  "100% open source (MIT license)",
  "Self-hosted — your data stays yours",
  "Unlimited automations & DMs",
  "Unlimited Instagram accounts",
  "Community support on GitHub",
];

const setupFeatures = [
  "Our devs set everything up for you",
  "Pay once — works for a lifetime",
  "VPS, database & worker configured",
  "Meta app + webhooks connected",
  "7-day priority support included",
];

export default function Pricing({
  initialPricing,
}: {
  initialPricing?: PricingInfo;
}) {
  const defaultPricing = PRICING_BY_GROUP.US_OTHER;
  const [pricing, setPricing] = useState<PricingInfo>(
    initialPricing ?? defaultPricing
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveGeoPricing() {
      // 1. Try edge-detected country via /api/geo (Vercel/Cloudflare headers)
      try {
        const res = await fetch("/api/geo", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            country: string | null;
            pricing: PricingInfo;
          };
          if (!cancelled && data.pricing) {
            // Validate pricing shape before using
            if (data.pricing.symbol && data.pricing.amount) {
              setPricing(data.pricing);
              return;
            }
            if (data.country) {
              setPricing(getPricingForCountry(data.country));
              return;
            }
          }
        }
      } catch {
        // ignore and fall back to client detection
      }

      // 2. Client fallback: navigator.language / timezone
      if (!cancelled) {
        const clientCountry = detectCountryClientSide();
        if (clientCountry) {
          setPricing(getPricingForCountry(clientCountry));
        }
      }
    }

    resolveGeoPricing();
    return () => {
      cancelled = true;
    };
  }, []);

  const mailSubject = `Done-for-you setup (${pricing.display} one-time)`;

  return (
    <section
      id="pricing"
      aria-label="Pricing"
      className="border-y border-border bg-muted/30"
    >
      <div className="mx-auto w-full max-w-8xl px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
        {/* Heading — eyebrow + headline like screenshot, now in theme tokens */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Pricing
          </p>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-[-6%] text-foreground sm:text-5xl lg:text-6xl">
            Transparent pricing,{" "}
            <span
              className={cn(
                "italic tracking-normal bg-clip-text text-transparent bg-linear-to-r from-primary to-foreground",
                dmSerif.className,
              )}
            >
              no hidden fees.
            </span>
          </h2>
        </div>

        {/* Cards — same layout as screenshot, now themed */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* ── Self-hosted · free ── light card uses bg-card */}
          <article className="flex flex-col rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-8">
            <span className="w-fit rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
              Self-Hosted
            </span>

            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-6xl font-semibold tracking-tighter text-foreground">
                $0
              </span>
              <span className="text-lg text-muted-foreground">/forever</span>
            </p>

            <div
              aria-hidden="true"
              className="my-7 border-t border-dashed border-border"
            />

            <ul className="flex flex-col gap-4">
              {selfHostedFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 text-[15px] font-medium text-foreground"
                >
                  <Check />
                  {f}
                </li>
              ))}
            </ul>

            <div
              aria-hidden="true"
              className="my-7 border-t border-dashed border-border"
            />

            <div className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-medium text-foreground">
                Deploy it yourself
              </span>
              <Toggle on={false} />
            </div>

            <Link
              href="/login"
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-[15px] font-semibold text-foreground shadow-sm transition-all hover:-translate-y-px hover:bg-muted"
            >
              <GithubLogoIcon weight="fill" className="size-4" />
              Start self-hosting
            </Link>
          </article>

          <article className="flex flex-col rounded-3xl border-4 border-lime-500 p-7 sm:p-8 relative overflow-clip">
            <div className="absolute -top-20 w-full h-20 bg-lime-500/40 pointer-events-none left-0 blur-3xl "></div>
            <div className="absolute -bottom-20 w-full h-20 bg-lime-500/40 pointer-events-none left-0 blur-3xl "></div>
            <div className="flex items-center justify-between gap-3">
              <span className="w-fit rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Done-For-You
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
                Lifetime deal
              </span>
            </div>

            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-6xl font-semibold tracking-tighter">
                {pricing.symbol}
                {pricing.amount}
              </span>
              <span className="text-lg text-muted-foreground">/one-time</span>
            </p>

            <div
              aria-hidden="true"
              className="my-7 border-t border-dashed border-white/15"
            />

            <ul className="flex flex-col gap-4">
              {setupFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 text-[15px] font-medium"
                >
                  <Check />
                  {f}
                </li>
              ))}
            </ul>

            <div
              aria-hidden="true"
              className="my-7 border-t border-dashed border-white/15"
            />

            <div className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-medium">
                Priority setup included
              </span>
              <Toggle on />
            </div>

            <a
              href={`mailto:${SETUP_EMAIL}?subject=${encodeURIComponent(mailSubject)}`}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-lg transition-all hover:-translate-y-px hover:brightness-[0.98]"
            >
              <WrenchIcon weight="duotone" className="size-4" />
              Get it set up
            </a>
          </article>
        </div>

        <div className="mx-auto mt-6 flex max-w-4xl items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm sm:px-8 sm:py-5">
          <p className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
            Prefer to email?
          </p>
          <a
            href={`mailto:${SETUP_EMAIL}?subject=${encodeURIComponent("Question about OpenInstaDM setup")}`}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-6 text-[15px] font-semibold text-foreground transition-all hover:-translate-y-px hover:bg-muted"
          >
            <EnvelopeSimpleIcon weight="duotone" className="size-4" />
            Email Us
          </a>
        </div>
      </div>
    </section>
  );
}
