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
  canCreateWorkspace: boolean;
  unlimitedWorkspaces: boolean;
  ownedWorkspaceCount: number;
  extraWorkspaceSlots: number;
  extraWorkspacePriceUsd: number;
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
  const [canCreateWorkspace, setCanCreateWorkspace] = useState(false);
  const [unlimitedWorkspaces, setUnlimitedWorkspaces] = useState(false);
  const [ownedWorkspaceCount, setOwnedWorkspaceCount] = useState(0);
  const [extraWorkspaceSlots, setExtraWorkspaceSlots] = useState(0);
  const [extraWorkspacePriceUsd, setExtraWorkspacePriceUsd] = useState(8);

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
      setCanCreateWorkspace(false);
      setUnlimitedWorkspaces(false);
      setOwnedWorkspaceCount(0);
      setExtraWorkspaceSlots(0);
      return [];
    }

    setUserId(user.id);

    const res = await fetch("/api/workspaces");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Failed to load workspaces:", json.error ?? res.status);
      return [];
    }

    setCanCreateWorkspace(Boolean(json.can_create_workspace));
    setUnlimitedWorkspaces(Boolean(json.unlimited_workspaces));
    setOwnedWorkspaceCount(
      typeof json.owned_workspace_count === "number"
        ? json.owned_workspace_count
        : 0
    );
    setExtraWorkspaceSlots(
      typeof json.extra_workspace_slots === "number"
        ? json.extra_workspace_slots
        : 0
    );
    if (typeof json.extra_workspace_price_usd === "number") {
      setExtraWorkspacePriceUsd(json.extra_workspace_price_usd);
    }

    const list = ((json.workspaces ?? []) as WorkspaceWithMembership[]).sort(
      (a, b) => a.name.localeCompare(b.name)
    );

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
      canCreateWorkspace,
      unlimitedWorkspaces,
      ownedWorkspaceCount,
      extraWorkspaceSlots,
      extraWorkspacePriceUsd,
    }),
    [
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      refreshWorkspaces,
      isLoading,
      canCreateWorkspace,
      unlimitedWorkspaces,
      ownedWorkspaceCount,
      extraWorkspaceSlots,
      extraWorkspacePriceUsd,
    ]
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
