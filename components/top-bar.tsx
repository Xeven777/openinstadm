"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { SignOut } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
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
  "/overview": "Overview",
  "/inbox": "Inbox",
};

interface TopBarProps {
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 lg:px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-sm font-semibold sm:text-base">{title}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
              buttonVariants({ variant: "default", size: "sm" }),
              "shrink-0 whitespace-nowrap",
            )}
          >
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Instagram</span>
          </a>
        )}
        <ModeToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
          title="Sign out"
        >
          <SignOut className="text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
