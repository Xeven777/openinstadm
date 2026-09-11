"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { SectionHeading } from "@/components/ui/section-heading";

type Card =
  | { type: "image"; src: string; alt: string }
  | {
      type: "testimonial";
      eyebrow: string;
      quote: string;
      name: string;
      handle: string;
      metric: string;
      metricLabel: string;
      variant: "lime" | "sky";
    };

const cards: Card[] = [
  {
    type: "image",
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlx103dpN2TSL67qFWmEsaQLx26CdFnmJuS3oxp4HDphoVazQB7d-JnIg&s=10",
    alt: "Iman Gadzhi",
  },
  {
    type: "testimonial",
    eyebrow: "Business & entrepreneurship",
    quote:
      "Comment SCALE and I’ll send you the framework. If you're serious about building a business, start here.",
    name: "Iman Gadzhi",
    handle: "@imangadzhi · Entrepreneur",
    metric: "Lead magnet",
    metricLabel: "delivered automatically",
    variant: "lime",
  },
  {
    type: "image",
    src: "https://images-na.ssl-images-amazon.com/images/S/amzn-author-media-prod/eov911dsc81vaj73li2pag9pt7.jpg",
    alt: "Business creator",
  },
  {
    type: "testimonial",
    eyebrow: "Business & marketing",
    quote:
      "Comment OFFER and I'll send you the exact framework. No complicated funnel. Just give people what they asked for.",
    name: "Alex Hormozi",
    handle: "@hormozi · Business educator",
    metric: "1 CTA",
    metricLabel: "turned into a conversation",
    variant: "sky",
  },
  {
    type: "image",
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRCfNU7PsGjMo23DjT6KgXgBOvJ-GE3Z9xhScMSLl9hgBxI1jfUUAneE_aT&s=10",
    alt: "Creator portrait",
  },
  {
    type: "testimonial",
    eyebrow: "Viral & high-engagement creators",
    quote:
      "Comment LINK and I'll DM it to you 👀. When a post blows up, you don't want to spend the whole night answering the same comment.",
    name: "Bonnie Blue",
    handle: "@bonnieblue · Adult Content creator",
    metric: "0 manual replies",
    metricLabel: "while comments keep coming",
    variant: "lime",
  },
  {
    type: "image",
    src: "https://yt3.googleusercontent.com/rILzbdwsdhr3OXFTLf_GEMLiy5Rurp4dowJoCTDzKKOPfhA5iT6t4tKFc5zAR5h9VgsEyJntGg=s900-c-k-c0x00ffffff-no-rj",
    alt: "Podcast microphone",
  },
  {
    type: "testimonial",
    eyebrow: "Podcasts & personal growth",
    quote:
      "Comment EPISODE and I'll send you the full conversation. One comment, one DM, straight to the episode.",
    name: "BeerBiceps",
    handle: "@beerbiceps · Podcast & creator",
    metric: "1 CTA",
    metricLabel: "to distribute every episode",
    variant: "sky",
  },
  {
    type: "image",
    src: "https://www.hindustantimes.com/ht-img/img/2026/04/15/1200x1600/Samay_Raina_1776060978634_1776060978871_1776242133373_1776244566862.jpg",
    alt: "Live comedy audience",
  },
  {
    type: "testimonial",
    eyebrow: "Comedy & entertainment",
    quote:
      "Comment TICKET and I'll send you the details. Because apparently replying to the same question 500 times isn't comedy.",
    name: "Samay Raina",
    handle: "@maisamayhoon · Comedian",
    metric: "1 → 1,000s",
    metricLabel: "comments handled automatically",
    variant: "lime",
  },
  {
    type: "image",
    src: "https://i.scdn.co/image/ab6765630000ba8a271520bec0ac82d57d0c2689",
    alt: "Podcast recording studio",
  },
  {
    type: "testimonial",
    eyebrow: "Business & podcasts",
    quote:
      "Comment PODCAST and I'll send you the episode. Turn the attention on the post into an actual conversation in the DMs.",
    name: "Raj Shamani",
    handle: "@rajshamani · Entrepreneur & podcaster",
    metric: "More conversations",
    metricLabel: "from every post",
    variant: "sky",
  },
  {
    type: "image",
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5HbJaEUgguWOW9MfHmeAGWp_aXdtPeoQshKGajq3h3wcj4s6jOXiH9g1u&s=10",
    alt: "Lifestyle creator",
  },
  {
    type: "testimonial",
    eyebrow: "Lifestyle & entertainment",
    quote:
      "Comment WATCH and I'll send you the video 💛. It's a tiny interaction, but it makes sharing content so much easier.",
    name: "MostlySane",
    handle: "@mostlysane · Creator & actor",
    metric: "Instant delivery",
    metricLabel: "from comment to DM",
    variant: "lime",
  },
];

const SPEED_PX_PER_SEC = 105;

function Stars() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="#facc15"
          stroke="#facc15"
          aria-hidden
        >
          <path d="M12 2.5l2.47 5.01 5.53.8-4 3.9.94 5.49L12 15.9l-4.94 2.8.94-5.49-4-3.9 5.53-.8L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCardContent({
  card,
}: {
  card: Extract<Card, { type: "testimonial" }>;
}) {
  return (
    <div className="relative flex h-full flex-col rounded-[24px] border border-white/55 bg-white/72 px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* top */}
      <div>
        <h3 className="text-2xl font-semibold leading-tight tracking-tighter">
          {card.eyebrow}
        </h3>
        <div className="mt-3">
          <Stars />
        </div>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-300">
          “{card.quote}”
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">{card.name}</p>
            <p className="mt-1 text-xs leading-none opacity-75">
              {card.handle}
            </p>
          </div>
        </div>
      </div>

      {/* bottom metric */}
      <div className="mt-auto pt-8">
        <p className="text-2xl font-semibold leading-none tracking-tighter">
          {card.metric}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {card.metricLabel}
        </p>
      </div>
    </div>
  );
}

function SlideCard({ card }: { card: Card }) {
  if (card.type === "image") {
    return (
      <div className="relative h-105 w-75 shrink-0 overflow-hidden rounded-[32px] border border-border bg-muted sm:h-110 sm:w-85 lg:w-90">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.src}
          alt={card.alt}
          className="absolute inset-0 size-full hover:scale-105 hover:brightness-110 transition-all duration-500 object-cover"
          loading="lazy"
          draggable={false}
        />
      </div>
    );
  }

  const isLime = card.variant === "lime";
  return (
    <div className="relative h-105 w-75 shrink-0 overflow-hidden rounded-[32px] border border-border p-2 sm:h-110 sm:w-85 lg:w-90">
      {/* colorful field behind frosted glass */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={
          isLime
            ? {
                background:
                  "linear-gradient(180deg, #f0f9ff 0%, #f8fafc 28%, #ffffff 42%, #ecfccb 62%, #a3e635 85%, #65a30d 100%)",
              }
            : {
                background:
                  "linear-gradient(180deg, #fce7f3 0%, #dbeafe 18%, #60a5fa 42%, #fef3c7 68%, #f9a8d4 84%, #86efac 100%)",
              }
        }
      />
      {/* blurred meadow detail at bottom */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[54%]"
        style={{
          background: isLime
            ? "linear-gradient(180deg, transparent 0%, rgba(132,204,22,0.18) 22%, rgba(101,163,13,0.32) 100%)"
            : "linear-gradient(180deg, transparent 0%, rgba(244,114,182,0.22) 18%, rgba(34,197,94,0.22) 100%)",
          filter: "blur(0.5px)",
        }}
      />
      {/* soft glow blobs */}
      <div
        aria-hidden
        className="absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-60 blur-2xl"
        style={{
          background: isLime
            ? "rgba(163,230,53,0.45)"
            : "rgba(96,165,250,0.55)",
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-12 -left-8 h-48 w-64 rounded-full opacity-40 blur-2xl"
        style={{
          background: isLime ? "rgba(34,197,94,0.5)" : "rgba(244,114,182,0.45)",
        }}
      />

      <TestimonialCardContent card={card} />
    </div>
  );
}

export default function Testimonials() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, {
    amount: 0.1,
    margin: "0px 0px -40px 0px",
  });

  const x = useMotionValue(0);
  const halfW = useRef(0);
  const draggingRef = useRef(false);

  // Measure one loop-half so the marquee can wrap seamlessly.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      // track holds 2 copies → one copy = half the scroll width
      halfW.current = el.scrollWidth / 2;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    // images load late — re-measure after they settle
    const t = setTimeout(measure, 1200);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, []);

  // Continuous scroll — only pauses off-screen, while dragging, or for reduced motion.
  useAnimationFrame((_, delta) => {
    if (reduceMotion || draggingRef.current || !inView) return;
    const half = halfW.current;
    if (!half || half <= 0) return;
    // clamp delta so tab-switch stalls don't teleport the track
    const step = SPEED_PX_PER_SEC * (Math.min(delta, 50) / 1000);
    let next = x.get() - step;
    if (next <= -half) next += half;
    x.set(next);
  });

  // Keep a manual drag inside the loop range so release never gaps.
  const wrapX = () => {
    const half = halfW.current;
    if (!half || half <= 0) return;
    let v = x.get() % half;
    if (v > 0) v -= half;
    x.set(v);
  };

  const setDragging = (value: boolean) => {
    draggingRef.current = value;
  };

  if (reduceMotion) {
    // Static, accessible fallback — native horizontal scroll, no animation.
    return (
      <section
        id="testimonials"
        aria-label="Testimonials — Built for anyone who turns comments into growth"
        className="overflow-hidden border-y border-border bg-background"
      >
        <div className="mx-auto w-full max-w-8xl px-5 py-14 sm:px-6 sm:py-16 lg:px-8">
          <SectionHeading
            eyebrow="Loved by creators"
            title="Built for anyone who"
            accent="turns comments into growth"
            description="From solo creators to agencies managing a dozen clients — see how OpenInstaDM replaces manual DMs and expensive tools."
          />
        </div>
        <div className="relative pb-14">
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 pt-2 sm:gap-5 sm:px-6 lg:px-8">
            {cards.map((card, i) => (
              <SlideCard key={i} card={card} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const loop = [...cards, ...cards];

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      aria-label="Testimonials — Built for anyone who turns comments into growth"
      className="overflow-hidden border-y border-border bg-background"
    >
      <div className="mx-auto w-full max-w-8xl px-5 py-14 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading
          eyebrow="Loved by creators"
          title="Built for anyone who"
          accent="turns comments into growth"
          description="From solo creators to agencies managing a dozen clients — see how OpenInstaDM replaces manual DMs and expensive tools."
        />
      </div>

      {/* carousel — bleeds to viewport edges, peek on sides like screenshot */}
      <div className="relative pb-14">
        {/* edge fades */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-linear-to-r from-background to-transparent sm:block lg:w-20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-12 bg-linear-to-l from-background to-transparent sm:block lg:w-20"
        />

        <div className="overflow-hidden">
          <motion.div
            ref={trackRef}
            style={{ x }}
            drag="x"
            dragElastic={0.12}
            dragMomentum={false}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => {
              setDragging(false);
              wrapX();
            }}
            className="flex w-max gap-4 px-5 pb-4 pt-2 sm:gap-5 sm:px-6 lg:px-8"
          >
            {loop.map((card, i) => (
              <SlideCard key={`${card.type}-${i}`} card={card} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
