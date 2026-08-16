"use client";

import { useRef, useState } from "react";
import { DashboardScrollProvider } from "@/components/dashboard-scroll";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceName: string;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function DashboardShell({
  children,
  workspaceName,
  instagramUsername,
  instagramAccountCount,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The dashboard's scroll surface. Islands virtualize against this element via
  // useDashboardScrollElement() rather than owning their own scroll container.
  const scrollElementRef = useRef<HTMLElement | null>(null);

  return (
    <DashboardScrollProvider value={{ scrollElementRef }}>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          workspaceName={workspaceName}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            onMenuClick={() => setSidebarOpen(true)}
            instagramUsername={instagramUsername}
            instagramAccountCount={instagramAccountCount}
          />

          <main ref={scrollElementRef} className="flex-1 overflow-y-auto">
            <div className="px-4 lg:px-8 py-5 sm:py-6 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardScrollProvider>
  );
}
