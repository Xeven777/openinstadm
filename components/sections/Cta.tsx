import { cn } from "@/lib/utils";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { Star, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

const Cta = () => {
  return (
    <section>
      <div className="mx-auto w-full max-w-8xl px-5 py-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border p-8 sm:p-12 lg:p-16 bg-black">
          <div className="absolute -top-50 left-1/2 -translate-x-1/2 w-100 blur-[100px] rounded-full bg-primary h-50 select-none pointer-events-none opacity-80"></div>
          <div className="flex flex-col items-center justify-between gap-6 lg:gap-8">
            <div>
              <h2 className="max-w-2xl text-4xl text-center font-semibold leading-tight tracking-tighter text-foreground sm:text-5xl">
                Turn your next reel&rsquo;s
                <br />
                comments into DMs
              </h2>
              <p className="mt-5 max-w-lg text-base md:text-lg text-muted-foreground">
                Free and open source.{" "}
                <Star
                  className="inline-block size-4 -mt-1 text-yellow-400"
                  weight="fill"
                />{" "}
                Star it if it saves you a subscription.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "glow", size: "lg" }),
                  "rounded-full px-6 h-12",
                )}
              >
                Get Started{" "}
                <ArrowRightIcon className="size-4 ml-2" weight="bold" />
              </Link>
              <a
                href={"https://github.com/xeven777/OpenInstaDM"}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full justify-center px-7 sm:w-auto rounded-full h-12",
                )}
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Cta;
