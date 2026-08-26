import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import Image from "next/image";
import bg from "@/assets/bg.webp";
import insta from "@/assets/Instagram.webp";
import chatBubbles from "@/assets/chatbubbles.webp";
import {
  CaretDoubleRightIcon,
  ClockAfternoonIcon,
  CrownSimpleIcon,
  FlagBannerIcon,
  MetaLogoIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr";
import OpenInstaDMAnimation from "./Animated";

export default function Hero() {
  return (
    <section
      aria-label="Hero — Turn Instagram comments into real conversations"
      className="relative isolate overflow-hidden min-h-lvh mask-b-from-90% bg-background"
    >
      <div className="absolute right-40 w-100 z-20 hidden lg:block">
        <OpenInstaDMAnimation />
      </div>
      {/* ── Background image ── */}
      <div className="absolute inset-0">
        <Image
          src={bg}
          alt=""
          aria-hidden="true"
          className="size-full object-cover object-[65%_40%] sm:object-[55%_35%] lg:object-center"
          loading="eager"
          decoding="async"
          width={1200}
          height={800}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            "linear-gradient(90deg, var(--background) 0%, color-mix(in oklab, var(--background) 98%, transparent) 18%, color-mix(in oklab, var(--background) 92%, transparent) 32%, color-mix(in oklab, var(--background) 72%, transparent) 48%, color-mix(in oklab, var(--background) 35%, transparent) 62%, transparent 78%)",
        }}
      />
      {/* Tablet */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block lg:hidden"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklab, var(--background) 98%, transparent) 0%, color-mix(in oklab, var(--background) 92%, transparent) 36%, color-mix(in oklab, var(--background) 55%, transparent) 58%, transparent 82%), linear-gradient(180deg, color-mix(in oklab, var(--background) 55%, transparent) 0%, transparent 28%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 sm:hidden"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--background) 92%, transparent) 0%, color-mix(in oklab, var(--background) 75%, transparent) 18%, color-mix(in oklab, var(--background) 45%, transparent) 36%, color-mix(in oklab, var(--background) 12%, transparent) 56%, transparent 72%), linear-gradient(90deg, color-mix(in oklab, var(--background) 88%, transparent) 0%, color-mix(in oklab, var(--background) 62%, transparent) 52%, transparent 92%)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative mx-auto flex min-h-130 w-full max-w-8xl items-center px-5 py-10 sm:min-h-140 sm:px-6 sm:py-14 lg:min-h-160 lg:px-8 lg:py-24 mt-15 xl:min-h-170">
        <div className="w-full max-w-160 xl:max-w-170">
          <p className="text-sm py-1 px-4 rounded-full w-fit tracking-wide shadow-lg border-2 inline-flex items-center gap-2 cursor-pointer bg-primary/15 text-lime-700 border-white/50 dark:bg-lime-400/10 dark:text-lime-300 dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <CrownSimpleIcon size={16} weight="duotone" />
            Free, Open-Source & Unlimited
            <CaretDoubleRightIcon size={16} weight="duotone" />
          </p>
          <h1 className="text-balance font-medium leading-[0.95] tracking-[-5%] xl:tracking-[-6.5%] text-foreground/90 dark:text-zinc-100">
            <span className="block text-3xl md:text-5xl lg:text-6xl xl:text-7xl">
              <span className="inline-flex items-baseline">
                Turn
                <Image
                  src={insta}
                  alt="Instagram"
                  width={100}
                  height={100}
                  className="size-9 translate-y-0.75 sm:size-12 sm:translate-y-5 sm:translate-x-3 lg:size-24 xl:size-24 scale-107 hover:scale-110 transition-transform duration-500 active:scale-100 active:translate-y-7 cursor-pointer dark:brightness-110"
                  style={{
                    filter:
                      "drop-shadow(rgba(255, 0, 72, 0.4) 1px 10px 10px)",
                  }}
                />
                <span className="bg-linear-to-l from-foreground/90 to-pink-600 dark:from-zinc-100 dark:to-pink-400 bg-clip-text text-transparent p-2">
                  Instagram
                </span>
              </span>
            </span>
            <span className="mt-1 block text-3xl md:text-5xl lg:text-6xl xl:text-7xl">
              comments into
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl md:text-5xl lg:text-6xl xl:text-7xl">
              real
              <Image
                src={chatBubbles}
                alt="Chat Bubbles"
                className="size-9 translate-y-0.75 sm:size-12 sm:translate-y-2 sm:translate-x-2.5 lg:size-15 xl:size-20 hover:scale-105 transition-transform duration-500 active:scale-x-95 active:translate-y-4 cursor-pointer brightness-110 dark:brightness-125 dark:drop-shadow-[0_8px_20px_rgba(132,204,22,0.25)]"
                width={100}
                height={100}
                style={{
                  filter: "drop-shadow(rgba(96, 140, 0, 0.5) 1px 10px 10px)",
                }}
              />
              <span className="bg-linear-to-l from-foreground/90 to-lime-600 dark:from-zinc-100 dark:to-lime-400 bg-clip-text text-transparent px-1">
                conversations
              </span>
            </span>
          </h1>

          <p className="mt-6 md:mt-8 max-w-xl tracking-tight font-light leading-relaxed text-primary-foreground/80 dark:text-zinc-300/90 dark:font-extralight text-base md:text-lg">
            Someone types &quot;link pls&quot; under your post, OpenInstaDM
            sends it to them before you&apos;ve even seen the notification. No
            monthly fee, nothing to babysit.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-12 w-full justify-center rounded-full font-semibold sm:w-auto px-6 bg-linear-to-b from-primary to-lime-300 text-black border-2 border-primary/50 hover:opacity-90 hover:scale-101 btn-shadow2 dark:from-lime-400 dark:to-lime-300 dark:border-lime-400/40 dark:shadow-[0_12px_32px_rgba(132,204,22,0.22)]",
              )}
            >
              Get Started{" "}
              <ArrowRightIcon className="size-4 ml-2" weight="bold" />
            </Link>
            <Link
              href="#how"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "h-12 w-full justify-center rounded-full font-semibold sm:w-auto px-6 bg-linear-to-t from-zinc-950 to-zinc-700 border-2 border-zinc-900/20 text-white hover:opacity-90 hover:scale-101 btn-shadow dark:from-zinc-100 dark:to-white dark:border-white/15 dark:text-zinc-900 dark:hover:from-white dark:hover:to-zinc-50 dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
              )}
            >
              See how it works
            </Link>
          </div>

          {/* Trust row — responsive, wraps on mobile */}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:mt-10 md:text-sm tracking-tight">
            <span className="inline-flex items-center gap-1.5 text-blue-600/70 dark:text-blue-400/90">
              <MetaLogoIcon className="size-5" />
              Official Meta API
            </span>
            <span className="hidden h-3 w-px bg-muted-foreground/50 dark:bg-white/15 sm:block" />
            <span className="inline-flex items-center gap-1.5 text-purple-800/70 dark:text-purple-300/80">
              <ClockAfternoonIcon className="size-5" />
              Runs 24/7
            </span>
            <span className="hidden h-3 w-px bg-muted-foreground/50 dark:bg-white/15 sm:block" />
            <span className="inline-flex items-center gap-1.5 text-rose-800/70 dark:text-rose-300/80">
              <FlagBannerIcon className="size-5" />
              No Bans
            </span>
          </div>
        </div>

        <div className="hidden flex-1 lg:block" aria-hidden="true" />
      </div>
    </section>
  );
}
