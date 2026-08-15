"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceWithMembership } from "@/types/database";

interface WorkspaceContextValue {
  workspaces: WorkspaceWithMembership[];
  activeWorkspace: WorkspaceWithMembership | null;
  setActiveWorkspace: (workspace: WorkspaceWithMembership) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
);

const storageKey = (userId: string) => `lunenix.activeWorkspace.${userId}`;

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembership[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] =
    useState<WorkspaceWithMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function load() {
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isMounted) {
          setWorkspaces([]);
          setActiveWorkspaceState(null);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) setUserId(user.id);

      // Fetch the workspaces this user is a member of via workspace_members.
      const { data, error } = await supabase
        .from("workspace_members")
        .select("role, workspaces(id, name, slug, created_at, logo_url)")
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to load workspaces:", error.message);
        if (isMounted) setIsLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as Array<{
        role: string;
        workspaces:
          | {
              id: string;
              name: string;
              slug: string;
              created_at: string;
              logo_url: string | null;
            }
          | null;
      }>;

      const list: WorkspaceWithMembership[] = rows
        .filter((r) => r.workspaces)
        .map((r) => ({
          ...(r.workspaces as NonNullable<typeof r.workspaces>),
          membership_role: r.role,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!isMounted) return;

      setWorkspaces(list);

      // Restore the persisted active workspace for this user, if valid.
      let initial: WorkspaceWithMembership | null = null;
      try {
        const savedId = window.localStorage.getItem(storageKey(user.id));
        if (savedId) {
          initial = list.find((w) => w.id === savedId) ?? null;
        }
      } catch {
        // localStorage may be unavailable; ignore.
      }
      if (!initial) initial = list[0] ?? null;

      setActiveWorkspaceState(initial);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const setActiveWorkspace = useCallback(
    (workspace: WorkspaceWithMembership) => {
      setActiveWorkspaceState(workspace);
      if (userId) {
        try {
          window.localStorage.setItem(storageKey(userId), workspace.id);
        } catch {
          // ignore persistence failures
        }
      }
    },
    [userId]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({ workspaces, activeWorkspace, setActiveWorkspace, isLoading }),
    [workspaces, activeWorkspace, setActiveWorkspace, isLoading]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
