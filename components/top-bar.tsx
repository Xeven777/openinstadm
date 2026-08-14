"use client";

import { usePathname } from "next/navigation";
import { List } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModeToggle } from "./theme-toggle";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/campaigns": "Campaigns",
  "/campaigns/new": "New Campaign",
  "/automations": "Campaigns",
  "/automations/new": "New Campaign",
  "/logs": "DM Logs",
  "/settings": "Settings",
  "/diagnostics": "Diagnostics",
};

interface TopBarProps {
  onMenuClick: () => void;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  onMenuClick,
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 h-16 px-4 lg:px-8 border-b border-border bg-background">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden shrink-0"
          aria-label="Toggle sidebar"
        >
          <List weight="bold" />
        </Button>
        <h1 className="truncate text-base font-semibold sm:text-lg lg:hidden">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {instagramAccountCount > 0 ? (
          <a
            href={"https://instagram.com/" + instagramUsername}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 truncate text-sm bg-linear-to-tl from-fuchsia-500 via-red-600 to-orange-400 text-transparent bg-clip-text dark:brightness-135 font-semibold tracking-tight"
          >
            {instagramAccountCount > 1
              ? `${instagramAccountCount} accounts`
              : `@${instagramUsername}`}
          </a>
        ) : (
          <a
            href="/api/instagram/connect"
            className={cn(
              buttonVariants({ variant: "default" }),
              "shrink-0 whitespace-nowrap",
            )}
          >
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Instagram</span>
          </a>
        )}
        <ModeToggle />
      </div>
    </header>
  );
}
