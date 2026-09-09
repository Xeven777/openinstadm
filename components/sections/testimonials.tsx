type Card =
  | { type: "image"; src: string; alt: string }
  | {
      type: "testimonial";
      eyebrow: string;
      quote: string;
      name: string;
      handle: string;
      avatar: string;
      metric: string;
      metricLabel: string;
      variant: "lime" | "sky";
    };

const cards: Card[] = [
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
    alt: "Creators collaborating",
  },
  {
    type: "testimonial",
    eyebrow: "Creators & coaches",
    quote:
      "Went from manually DMing 200 comments a day to zero. 1,284 links sent on our last launch — while I was asleep.",
    name: "Maya Chen",
    handle: "@maya.co · 240k followers",
    avatar: "https://i.pravatar.cc/100?img=5",
    metric: "1.2k DMs",
    metricLabel: "avg. per launch",
    variant: "lime",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
    alt: "Founder smiling",
  },
  {
    type: "testimonial",
    eyebrow: "Agencies & managers",
    quote:
      "We run comment-to-DM for 12 clients from one workspace. No seat caps, no per-DM fees. Client reporting is automatic.",
    name: "Ray Alvarez",
    handle: "@founder.ray · Social agency",
    avatar: "https://i.pravatar.cc/100?img=12",
    metric: "12 clients",
    metricLabel: "one dashboard",
    variant: "sky",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    alt: "E-commerce founder",
  },
  {
    type: "testimonial",
    eyebrow: "Brands & shops",
    quote:
      "Turned “link pls” into tracked sales. 27.7% CTR and every click is attributed — finally we know what converts.",
    name: "Ava Patel",
    handle: "@shop.ava · Shopify store",
    avatar: "https://i.pravatar.cc/100?img=9",
    metric: "0 missed",
    metricLabel: "webhooks + polling",
    variant: "lime",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
    alt: "Creator portrait",
  },
  {
    type: "testimonial",
    eyebrow: "Founders & indie hackers",
    quote:
      "Self-hosted in 20 minutes on Railway. Saved $400/mo vs Manychat and we own the data. MIT-licensed, no lock-in.",
    name: "Daniel Kim",
    handle: "@dan.builds · SaaS founder",
    avatar: "https://i.pravatar.cc/100?img=15",
    metric: "100% OSS",
    metricLabel: "MIT licensed",
    variant: "sky",
  },
];

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
        <h3 className="text-[22px] font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
          {card.eyebrow}
        </h3>
        <div className="mt-3">
          <Stars />
        </div>
        <p className="mt-3 text-[14px] leading-[1.55] text-zinc-600 dark:text-zinc-300">
          “{card.quote}”
        </p>
        <div className="mt-4 flex items-center gap-3">
          {/* eslint-disable @next/next/no-img-element */}
          <img
            src={card.avatar}
            alt={card.name}
            width={36}
            height={36}
            className="size-9 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-none text-zinc-900 dark:text-white">
              {card.name}
            </p>
            <p className="mt-1 text-xs leading-none text-zinc-500 dark:text-zinc-400">
              {card.handle}
            </p>
          </div>
        </div>
      </div>

      {/* bottom metric */}
      <div className="mt-auto pt-8">
        <p className="text-[22px] font-bold leading-none tracking-tight text-zinc-900 dark:text-white">
          {card.metric}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {card.metricLabel}
        </p>
      </div>
    </div>
  );
}

export default function Testimonials() {
  return (
    <section
      id="testimonials"
      aria-label="Testimonials — Built for anyone who turns comments into growth"
      className="overflow-hidden border-y border-border bg-background"
    >
      {/* header - centered like screenshot */}
      <div className="mx-auto w-full max-w-8xl px-5 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground shadow-sm dark:bg-card">
            Loved by creators
          </span>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-[0.95] tracking-tighter text-foreground sm:text-5xl lg:text-[56px]">
            Built for anyone who
            <br />
            turns comments into growth
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            From solo creators to agencies managing a dozen clients — see how
            OpenInstaDM replaces manual DMs and expensive tools.
          </p>
        </div>
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

        <div
          className="flex gap-4 overflow-x-auto scroll-smooth px-5 pb-4 pt-2 sm:gap-5 sm:px-6 lg:px-8 scrollbar-none [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {cards.map((card, i) => {
            if (card.type === "image") {
              return (
                <div
                  key={`img-${i}`}
                  className="relative h-105 w-75 shrink-0 snap-start overflow-hidden rounded-[32px] border border-border bg-muted sm:h-110 sm:w-85 lg:w-90"
                >
                  <img
                    src={card.src}
                    alt={card.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  {/* subtle vignette */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/15 via-transparent to-transparent" />
                </div>
              );
            }

            const isLime = card.variant === "lime";
            return (
              <div
                key={`t-${i}`}
                className="relative h-105 w-75 shrink-0 snap-start overflow-hidden rounded-[32px] border border-border p-2 sm:h-110 sm:w-85 lg:w-90"
              >
                {/* colorful field behind frosted glass — matches screenshot vibe */}
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
                    background: isLime
                      ? "rgba(34,197,94,0.5)"
                      : "rgba(244,114,182,0.45)",
                  }}
                />

                <TestimonialCardContent card={card} />
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
          Swipe to explore →
        </p>
      </div>
    </section>
  );
}
