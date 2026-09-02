import Image from "next/image";
import Link from "next/link";
import { ModeToggle } from "../theme-toggle";
import { GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "../ui/button";
import { cn, formatStars } from "@/lib/utils";

const GITHUB_URL = "https://github.com/xeven777/OpenInstaDM";

async function getGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/xeven777/OpenInstaDM",
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 36000 },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

const Navbar = async () => {
  const stars = await getGitHubStars();

  return (
    <header className="fixed w-11/12 top-2 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl rounded-full -translate-x-1/2 left-1/2">
      <div className="mx-auto flex h-15 w-full max-w-8xl items-center justify-between px-5 sm:px-6 lg:px-8 rounded-full">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="OpenInstaDM home"
        >
          <Image
            src="/logo1.svg"
            alt="OpenInstaDM logo"
            width={32}
            height={32}
            className="size-8 transition-all duration-300 dark:invert-0 invert shimmer"
          />
          <span className="text-lg font-bold tracking-tight text-foreground hidden md:block">
            OpenInstaDM
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ModeToggle />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="View OpenInstaDM on GitHub"
          >
            <GithubLogoIcon
              weight="fill"
              className="h-4 w-4"
              aria-hidden="true"
            />
            {stars !== null && <span>{formatStars(stars)}</span>}
          </a>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "glow" }),
              "rounded-full h-10",
            )}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
