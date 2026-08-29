import Link from "next/link";
import Image from "next/image";
import { GithubLogoIcon, HeartIcon } from "@phosphor-icons/react/dist/ssr";

const GITHUB_URL = "https://github.com/xeven777/OpenInstaDM";

const footerLinks = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "How it works", href: "/#how" },
    { label: "Dashboard", href: "/login" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs" },
    { label: "Setup guide", href: "/docs#setup" },
    { label: "Meta review", href: "/meta-review" },
    { label: "Diagnostics", href: "/docs#diagnostics" },
  ],
  Legal: [
    { label: "Privacy policy", href: "/privacy" },
    { label: "Terms of service", href: "/terms" },
    { label: "Data deletion", href: "/data-deletion" },
  ],
  Compare: [
    { label: "Manychat alternative", href: "/manychat-alternative" },
    {
      label: "DM automation agencies",
      href: "/instagram-dm-automation-agencies",
    },
    {
      label: "Comment-to-DM templates",
      href: "/instagram-comment-to-dm-templates",
    },
    { label: "Comment link automation", href: "/comment-link-automation" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-border relative">
      <div className="mx-auto max-w-8xl px-5 sm:px-6 lg:px-8">
        {/* Main footer grid */}
        <div className="grid grid-cols-2 gap-10 py-16 sm:grid-cols-3 lg:grid-cols-6 lg:gap-8">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2"
              aria-label="OpenInstaDM home"
            >
              <Image
                src="/logo1.svg"
                alt="OpenInstaDM logo"
                width={28}
                height={28}
                className="size-7 transition-all duration-300 dark:invert-0 invert"
              />
              <span className="text-base font-bold tracking-tight text-foreground">
                OpenInstaDM
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Open-source Instagram comment-to-DM automation. Turn engagement
              into conversations.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                aria-label="View on GitHub"
              >
                <GithubLogoIcon weight="fill" className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border py-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 OpenInstaDM. Open source under the MIT License.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            Built with{" "}
            <HeartIcon
              weight="fill"
              className="h-3 w-3 text-destructive"
              aria-hidden="true"
            />{" "}
            for the open-source community
          </p>
        </div>

        <div className="flex items-center justify-center font-bold tracking-[-9%] text-[clamp(3rem,18vw,18rem)] leading-none bg-clip-text text-transparent bg-linear-to-b from-foreground to-transparent absolute left-1/2 -translate-x-1/2 opacity-60 pointer-events-none">
          OpenInstaDM
        </div>
      </div>
    </footer>
  );
}
