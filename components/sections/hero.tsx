import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import Image from "next/image";
import bg from "@/assets/bg.webp";
import insta from "@/assets/Instagram.webp";
import chatBubbles from "@/assets/chatbubbles.webp";

export default function Hero() {
  return (
    <section
      aria-label="Hero — Turn Instagram comments into real conversations"
      className="relative isolate overflow-hidden min-h-lvh mask-b-from-90%"
    >
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
      <div className="relative mx-auto flex min-h-130 w-full max-w-7xl items-center px-5 py-10 sm:min-h-140 sm:px-6 sm:py-14 lg:min-h-160 lg:px-8 lg:py-24 mt-16 xl:min-h-170">
        <div className="w-full max-w-160 xl:max-w-170">
          <h1 className="text-balance font-semibold leading-[0.95] tracking-[-5%] xl:tracking-[-6.5%] text-foreground/90">
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
                className="size-9 translate-y-0.75 sm:size-12 sm:translate-y-2 sm:translate-x-2.5 lg:size-15 xl:size-20 hover:scale-105 transition-transform duration-500 active:scale-95 active:translate-y-4 cursor-pointer brightness-110"
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

          {/* Subtext — smaller like screenshot */}
          <p className="mt-6 max-w-xl tracking-tight font-thin leading-relaxed text-primary-foreground/80">
            Someone types &quot;link pls&quot; under your post, OpenInstaDM DMs it to them
            before you&apos;ve even seen the notification. No monthly fee, nothing to
            babysit.
          </p>

          {/* CTAs — fully responsive, full-width on mobile */}
          <div className="mt-8 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-12 w-full justify-center rounded-full bg-[#0f1e04] px-8 text-[15px] font-semibold text-white shadow-[0_4px_20px_rgba(15,30,4,0.18)] hover:bg-[#1a2f04] sm:w-auto",
              )}
            >
              Start free — no card required
            </Link>
            <Link
              href="#how"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 w-full justify-center rounded-full border-[#0f1e04]/15 bg-white/90 px-8 text-[15px] font-semibold text-[#0f1e04] backdrop-blur hover:bg-white sm:w-auto",
              )}
            >
              See how it works
            </Link>
          </div>

          {/* Trust row — responsive, wraps on mobile */}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[#1e2f0f]/60 sm:mt-7 sm:text-[13px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#3a5a0a] opacity-70" />
              Official Meta API
            </span>
            <span className="hidden h-3 w-px bg-[#0f1e04]/15 sm:block" />
            <span>No scraping · Encrypted tokens</span>
          </div>
        </div>

        {/* Right spacer keeps image chair visible on large screens */}
        <div className="hidden flex-1 lg:block" aria-hidden="true" />
      </div>
    </section>
  );
}
