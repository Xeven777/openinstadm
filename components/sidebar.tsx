"use client";

/**
 * Sidebar Navigation
 *
 * Sectioned nav (Workspace / Automation / System) with a green active pill,
 * brand mark, and workspace avatar footer. Icons are Phosphor; active items
 * get a filled weight icon on a primary-tinted pill.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CaretUpDown,
  ChartLine,
  ChatCircle,
  Check,
  Gear,
  ListDashes,
  Megaphone,
  PaperPlaneTilt,
  Pulse,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
}

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: SquaresFour },
      { label: "Overview", href: "/overview", icon: ChartLine },
      { label: "Inbox", href: "/inbox", icon: ChatCircle },
    ],
  },
  {
    label: "Automation",
    items: [
      { label: "Campaigns", href: "/campaigns", icon: Megaphone },
      { label: "DM Logs", href: "/logs", icon: ListDashes },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Gear },
      { label: "Diagnostics", href: "/diagnostics", icon: Pulse },
    ],
  },
];

function workspaceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "WS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  /** Active workspace id — drives the switcher highlight. */
  workspaceId: string;
  /** All workspaces the user belongs to. */
  workspaces: Array<{ id: string; name: string; role: string }>;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
  workspaceId,
  workspaces,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function switchWorkspace(nextWorkspaceId: string) {
  if (nextWorkspaceId === workspaceId || switching) return;

  setSwitching(true);

  try {
    const response = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: nextWorkspaceId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Failed to switch workspace");
    }

    // Force a new server request so the dashboard layout reads the new cookie.
    window.location.assign("/dashboard");
  } catch (error) {
    console.error("Failed to switch workspace:", error);
    setSwitching(false);
  }
}

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 bg-card border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="px-5 py-5 border-b border-border">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5"
            aria-label="OpenInstaDM dashboard"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <PaperPlaneTilt weight="fill" className="size-4" />
            </span>
            <span className="truncate text-base font-semibold tracking-tight text-foreground">
              OpenInstaDM
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const NavIcon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "w-full justify-start gap-2.5 px-3",
                        isActive
                          ? "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      <NavIcon
                        weight={isActive ? "fill" : "regular"}
                        className="size-4 shrink-0"
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Switch workspace"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/50 data-popup-open:bg-muted/50"
            >
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {workspaceInitials(workspaceName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {workspaceName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {workspaces.length} workspace
                  {workspaces.length === 1 ? "" : "s"}
                </p>
              </div>
              <CaretUpDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-(--anchor-width)"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              </DropdownMenuGroup>
              {workspaces.map((workspace) => {
                const isActive = workspace.id === workspaceId;
                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    onClick={() => void switchWorkspace(workspace.id)}
                    disabled={switching}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                      {workspaceInitials(workspace.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{workspace.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {workspace.role.toLowerCase()}
                      </span>
                    </span>
                    {isActive && <Check className="size-4 shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
