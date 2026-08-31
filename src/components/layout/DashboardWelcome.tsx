"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";

export function DashboardWelcome() {
  const { activeWorkspace, isLoading } = useWorkspace();

  const name = isLoading
    ? "…"
    : activeWorkspace?.name ?? "your workspace";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Welcome to {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Here&apos;s an overview of your workspace.
      </p>
    </div>
  );
}
