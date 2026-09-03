import { cn } from "@/lib/utils";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { Star, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

const Cta = () => {
  return (
    <section className="relative isolate flex min-h-130 items-center overflow-hidden border-y border-border">
      {/* Theme-aware background image */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-cover bg-center dark:hidden"
            style={{ backgroundImage: "url('/cta-light.png')" }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 hidden bg-cover bg-center dark:block"
            style={{ backgroundImage: "url('/cta-dark.png')" }}
          />

          {/* Ensures copy remains readable over the artwork */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-r from-background/95 via-background/60 to-transparent dark:from-black/95 dark:via-black/60 dark:to-transparent"
          />

          <div className="mx-auto w-full max-w-8xl px-6 py-24 sm:px-10 lg:px-16">
            <h2 className="text-3xl font-semibold leading-tight tracking-tighter text-foreground sm:text-5xl dark:text-white">
              Turn your next reel&rsquo;s
              <br />
              comments into DMs
            </h2>

            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg dark:text-zinc-300">
              Free and open source.{" "}
              <Star
                className="inline-block size-4 -mt-1 text-yellow-400"
                weight="fill"
              />{" "}
              Star it if it saves you a subscription.
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "glow", size: "lg" }),
                  "h-12 rounded-full px-6 btn-shadow2",
                )}
              >
                Get Started{" "}
                <ArrowRightIcon className="ml-2 size-4" weight="bold" />
              </Link>

              <a
                href="https://github.com/xeven777/OpenInstaDM"
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 w-full justify-center rounded-full px-7 sm:w-auto bg-background/70 dark:bg-black/40",
                )}
              >
                View on GitHub
              </a>
            </div>
          </div>
        
    </section>
  );
};

export default Cta;