import Image from "next/image";
import img1 from "@/assets/ChatGPT Image Aug 26, 2026, 10_07_44 PM.webp";
import img2 from "@/assets/ChatGPT Image Aug 26, 2026, 10_09_18 PM.webp";
import img3 from "@/assets/ChatGPT Image Aug 26, 2026, 10_18_50 PM.webp";

const flowSteps = [
  {
    number: "01",
    title: "Connect your Instagram",
    description:
      "Sign in by email and link your professional account once. No password sharing, no browser automation, no risk.",
    image: img1,
  },
  {
    number: "02",
    title: "Set keywords and replies",
    description:
      "Create a campaign: pick a post, choose the keyword to watch, write the DM and optional public reply.",
    image: img2,
  },
  {
    number: "03",
    title: "It runs itself",
    description:
      "Webhooks catch comments instantly. A polling sweep catches anything Instagram misses. Every send is queued, rate-limited, and logged.",
    image: img3,
  },
];

const HowWorks = () => {
  return (
    <section id="how">
      <div className="mx-auto w-full max-w-8xl px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="flex items-center justify-center gap-3">
          <span className="hidden h-px w-10 bg-border sm:block sm:w-20" />
          <span className="hidden size-1.5 rounded-full border border-border bg-white dark:bg-card sm:block" />
          <span className="inline-flex items-center rounded-full border border-border bg-white px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm dark:bg-card">
            How it works
          </span>
          <span className="hidden size-1.5 rounded-full border border-border bg-white dark:bg-card sm:block" />
          <span className="hidden h-px w-10 bg-border sm:block sm:w-20" />
        </div>

        {/* Heading — keep original text, center like screenshot */}
        <div className="mx-auto mt-6 max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold leading-[0.98] tracking-[-5%] text-transparent bg-clip-text bg-linear-to-br from-foreground/80 to-primary via-foreground sm:text-5xl lg:text-6xl">
            A comment in,
            <br />a DM out
          </h2>
          <p className="mx-auto mt-4 max-w-150 text-pretty text-sm lg:text-base leading-relaxed text-muted-foreground">
            Three steps. Connect an account, build a campaign, and let it run.
            The webhook handles it live and the poll sweeps up whatever
            Instagram never pushes.
          </p>
        </div>

        {/* Cards — 3-up grid like screenshot */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {flowSteps.map((step) => (
            <article
              key={step.title}
              className="group relative flex flex-col overflow-hidden rounded-3xl border  bg-card shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
            >
              <div className="relative h-75 w-full overflow-hidden sm:h-90 mask-y-from-80%">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Text area */}
              <div className="relative flex flex-1 flex-col px-6 pb-7 pt-2">
                <div className="mb-3 inline-flex w-fit rounded-full bg-primary px-2.5 py-1 text-xs font-semibold tracking-wide text-primary-foreground">
                  {step.number}
                </div>
                <h3 className="text-base font-semibold leading-none tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowWorks;
