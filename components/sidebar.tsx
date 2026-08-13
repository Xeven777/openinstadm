"use client";

/**
 * Sidebar Navigation
 *
 * Nav items as ghost buttons with active state and Phosphor icons.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLine,
  ChatCircle,
  Gear,
  ListDashes,
  Megaphone,
  Pulse,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems: Array<{ label: string; href: string; icon: Icon }> = [
  { label: "Dashboard", href: "/dashboard", icon: SquaresFour },
  { label: "Overview", href: "/overview", icon: ChartLine },
  { label: "Inbox", href: "/inbox", icon: ChatCircle },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "DM Logs", href: "/logs", icon: ListDashes },
  { label: "Settings", href: "/settings", icon: Gear },
  { label: "Diagnostics", href: "/diagnostics", icon: Pulse },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
}: SidebarProps) {
  const pathname = usePathname();

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
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 bg-muted border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="px-6 py-5 border-b border-border">
          <Link href="/dashboard" className="text-base font-semibold">
            OpenInstaDM
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
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
                    ? "bg-muted font-medium text-foreground"
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
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-sm text-foreground truncate">{workspaceName}</p>
          <p className="text-xs text-muted-foreground">Self-hosted</p>
        </div>
      </aside>
    </>
  );
}
