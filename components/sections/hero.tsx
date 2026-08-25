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
      className="relative isolate overflow-hidden min-h-lvh mask-b-from-90%"
    >
      <div className="absolute top-20 right-40 w-[400px] h-[500px] z-20">
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
            "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 18%, rgba(255,255,255,0.92) 32%, rgba(255,255,255,0.72) 48%, rgba(255,255,255,0.35) 62%, rgba(255,255,255,0) 78%)",
        }}
      />
      {/* Tablet */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block lg:hidden"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 36%, rgba(255,255,255,0.55) 58%, rgba(255,255,255,0) 82%), linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 28%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 sm:hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.75) 18%, rgba(255,255,255,0.45) 36%, rgba(255,255,255,0.12) 56%, rgba(255,255,255,0) 72%), linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.62) 52%, rgba(255,255,255,0) 92%)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative mx-auto flex min-h-130 w-full max-w-8xl items-center px-5 py-10 sm:min-h-140 sm:px-6 sm:py-14 lg:min-h-160 lg:px-8 lg:py-24 mt-15 xl:min-h-170">
        <div className="w-full max-w-160 xl:max-w-170">
          <p className="text-sm py-1 px-4 text-lime-700 rounded-full bg-primary/15 w-fit tracking-wide shadow-lg border-2 border-white/50 inline-flex items-center gap-2 cursor-pointer">
            <CrownSimpleIcon size={16} weight="duotone" />
            Free, Open-Source & Unlimited
            <CaretDoubleRightIcon size={16} weight="duotone" />
          </p>
          <h1 className="text-balance font-medium leading-[0.95] tracking-[-5%] xl:tracking-[-6.5%] text-foreground/90">
            <span className="block text-3xl md:text-5xl lg:text-6xl xl:text-7xl">
              <span className="inline-flex items-baseline">
                Turn
                <Image
                  src={insta}
                  alt="Instagram"
                  width={100}
                  height={100}
                  className="size-9 translate-y-0.75 sm:size-12 sm:translate-y-5 sm:translate-x-3 lg:size-24 xl:size-24 scale-107 hover:scale-110 transition-transform duration-500 active:scale-100 active:translate-y-7 cursor-pointer"
                  style={{
                    filter: "drop-shadow(rgba(255, 0, 72, 0.4) 1px 10px 10px)",
                  }}
                />
                <span className="bg-linear-to-l from-foreground/90 to-pink-600 bg-clip-text text-transparent p-2">
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
                className="size-9 translate-y-0.75 sm:size-12 sm:translate-y-2 sm:translate-x-2.5 lg:size-15 xl:size-20 hover:scale-105 transition-transform duration-500 active:scale-x-95 active:translate-y-4 cursor-pointer brightness-110"
                width={100}
                height={100}
                style={{
                  filter: "drop-shadow(rgba(96, 140, 0, 0.5) 1px 10px 10px)",
                }}
              />
              <span className="bg-linear-to-l from-foreground/90 to-lime-600 bg-clip-text text-transparent px-1">
                conversations
              </span>
            </span>
          </h1>

          <p className="mt-6 md:mt-8 max-w-xl tracking-tight font-thin leading-relaxed text-primary-foreground/80 text-base md:text-lg">
            Someone types &quot;link pls&quot; under your post, OpenInstaDM
            sends it to them before you&apos;ve even seen the notification. No
            monthly fee, nothing to babysit.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-12 w-full justify-center rounded-full font-semibold sm:w-auto px-6 bg-linear-to-b from-primary to-lime-300 text-black border-2 border-primary/50 hover:opacity-90 hover:scale-101 btn-shadow2",
              )}
            >
              Get Started{" "}
              <ArrowRightIcon className="size-4 ml-2" weight="bold" />
            </Link>
            <Link
              href="#how"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "h-12 w-full justify-center rounded-full font-semibold sm:w-auto px-6 bg-linear-to-t from-zinc-950 to-zinc-700 border-2 border-zinc-900/20 text-white hover:opacity-90 hover:scale-101 btn-shadow",
              )}
            >
              See how it works
            </Link>
          </div>

          {/* Trust row — responsive, wraps on mobile */}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:mt-10 md:text-sm tracking-tight">
            <span className="inline-flex items-center gap-1.5 text-blue-600/70">
              <MetaLogoIcon className="size-5" />
              Official Meta API
            </span>
            <span className="hidden h-3 w-px bg-muted-foreground/50 sm:block" />
            <span className="inline-flex items-center gap-1.5 text-purple-800/70">
              <ClockAfternoonIcon className="size-5" />
              Runs 24/7
            </span>
            <span className="hidden h-3 w-px bg-muted-foreground/50 sm:block" />
            <span className="inline-flex items-center gap-1.5 text-rose-800/70">
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
