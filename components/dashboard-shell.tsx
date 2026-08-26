"use client";

import AppSidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";

export interface ShellWorkspace {
  id: string;
  name: string;
  role: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceName: string;
  workspaceId: string;
  workspaces: ShellWorkspace[];
  instagramUsername: string | null;
  instagramAccountCount: number;
  /** Initial open state derived from the `sidebar_state` cookie on the server. */
  defaultOpen?: boolean;
}

export default function DashboardShell({
  children,
  workspaceName,
  workspaceId,
  workspaces,
  instagramUsername,
  instagramAccountCount,
  defaultOpen = true,
}: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <TooltipProvider>
        <AppSidebar
          workspaceName={workspaceName}
          workspaceId={workspaceId}
          workspaces={workspaces}
        />
        <SidebarInset>
          <TopBar
            instagramUsername={instagramUsername}
            instagramAccountCount={instagramAccountCount}
          />
          <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
