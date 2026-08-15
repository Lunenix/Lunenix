"use client";

import { useState } from "react";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

interface DashboardShellProps {
  userEmail?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
}

export function DashboardShell({
  userEmail,
  userName,
  avatarUrl,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          userEmail={userEmail}
          userName={userName}
          avatarUrl={avatarUrl}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            userEmail={userEmail}
            userName={userName}
            avatarUrl={avatarUrl}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
