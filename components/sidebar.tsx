"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretUpDown,
  ChartLine,
  ChatCircle,
  Check,
  Gear,
  ListDashes,
  Megaphone,
  Pulse,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import Image from "next/image";

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

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  workspaceName: string;
  workspaceId: string;
  workspaces: Array<{ id: string; name: string; role: string }>;
}

export default function AppSidebar({
  workspaceName,
  workspaceId,
  workspaces,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();
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
      window.location.assign("/dashboard");
    } catch (error) {
      console.error("Failed to switch workspace:", error);
      setSwitching(false);
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="OpenInstaDM"
              render={<Link href="/dashboard" />}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image
                  src="/logo2.svg"
                  alt="OpenInstaDM"
                  width={20}
                  height={20}
                />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate md:text-lg tracking-tight">
                  OpenInstaDM
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const NavIcon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <NavIcon weight={isActive ? "fill" : "regular"} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    aria-label="Switch workspace"
                  />
                }
              >
                <Avatar className="size-8 rounded-full">
                  <AvatarImage
                    src={`https://api.dicebear.com/10.x/glass/svg?seed=${encodeURIComponent(workspaceName)}`}
                  />
                  <AvatarFallback className="rounded-full bg-primary/15 text-primary text-xs font-bold">
                    {workspaceInitials(workspaceName)}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{workspaceName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {workspaces.length} workspace
                    {workspaces.length === 1 ? "" : "s"}
                  </span>
                </span>
                <CaretUpDown className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                sideOffset={8}
                className="w-(--anchor-width) min-w-56 rounded-lg"
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
                      className="gap-2 p-2"
                    >
                      <Avatar className="size-8 rounded-full">
                        <AvatarImage
                          src={`https://api.dicebear.com/10.x/glass/svg?seed=${encodeURIComponent(workspaceName)}`}
                        />
                        <AvatarFallback className="rounded-full bg-primary/15 text-primary text-xs font-bold">
                          {workspaceInitials(workspaceName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">
                          {workspace.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {workspace.role.toLowerCase()}
                        </span>
                      </span>
                      {isActive && <Check className="size-4 shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
