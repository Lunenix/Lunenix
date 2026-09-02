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
  refreshWorkspaces: () => Promise<WorkspaceWithMembership[]>;
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

  // Fetch the workspaces the current user belongs to. Returns the list so
  // callers (e.g. after creating/renaming a workspace) can act on it.
  const fetchWorkspaces = useCallback(async (): Promise<
    WorkspaceWithMembership[]
  > => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setWorkspaces([]);
      return [];
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspaces(*)")
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to load workspaces:", error.message);
      return [];
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
            industry_preset: string | null;
            phone?: string | null;
            team_size?: string | null;
            max_seats: number | null;
            tier: string | null;
            trial_ends_at?: string | null;
          }
        | null;
    }>;

    const list: WorkspaceWithMembership[] = rows
      .filter((r) => r.workspaces)
      .map((r) => {
        const ws = r.workspaces as NonNullable<typeof r.workspaces>;
        return {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          created_at: ws.created_at,
          logo_url: ws.logo_url,
          industry_preset: ws.industry_preset,
          phone: ws.phone ?? null,
          team_size: ws.team_size ?? null,
          max_seats: ws.max_seats ?? undefined,
          tier: ws.tier ?? undefined,
          trial_ends_at: ws.trial_ends_at ?? null,
          membership_role: r.role,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setWorkspaces(list);
    return list;
  }, []);

  // Public refresh: re-fetch and keep the active workspace in sync with the
  // freshly loaded rows (so renames reflect immediately).
  const refreshWorkspaces = useCallback(async (): Promise<
    WorkspaceWithMembership[]
  > => {
    const list = await fetchWorkspaces();
    setActiveWorkspaceState((current) => {
      if (!current) return current;
      const updated = list.find((w) => w.id === current.id);
      return updated ?? current;
    });
    return list;
  }, [fetchWorkspaces]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const supabase = createClient();
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

      const list = await fetchWorkspaces();
      if (!isMounted) return;

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
  }, [fetchWorkspaces]);

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
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      refreshWorkspaces,
      isLoading,
    }),
    [workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces, isLoading]
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
