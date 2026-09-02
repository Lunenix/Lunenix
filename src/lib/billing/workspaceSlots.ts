import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import {
  EXTRA_WORKSPACE_PRICE_USD,
  ownedWorkspaceAllowance,
} from "@/lib/workspace";

export type WorkspaceCreateEntitlement = {
  unlimited: boolean;
  ownedCount: number;
  extraSlots: number;
  allowance: number;
  canCreate: boolean;
};

export async function countOwnedWorkspaces(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await admin
    .from("workspace_members")
    .select("workspace_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "owner");
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function getExtraWorkspaceSlots(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await admin
    .from("profiles")
    .select("extra_workspace_slots")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("extra_workspace_slots read failed:", error.message);
    return 0;
  }
  const slots = (data as { extra_workspace_slots?: number } | null)
    ?.extra_workspace_slots;
  return typeof slots === "number" && slots > 0 ? slots : 0;
}

export async function getWorkspaceCreateEntitlement(
  admin: SupabaseClient,
  user: Pick<User, "id" | "app_metadata">
): Promise<WorkspaceCreateEntitlement> {
  const unlimited = isSuperAdmin(user);
  const [ownedCount, extraSlots] = await Promise.all([
    countOwnedWorkspaces(admin, user.id),
    getExtraWorkspaceSlots(admin, user.id),
  ]);
  const allowance = ownedWorkspaceAllowance(extraSlots);
  return {
    unlimited,
    ownedCount,
    extraSlots,
    allowance,
    canCreate: unlimited || ownedCount < allowance,
  };
}

export async function grantExtraWorkspaceSlot(
  admin: SupabaseClient,
  userId: string,
  checkoutSessionId: string
): Promise<boolean> {
  const { data, error } = await admin.rpc("grant_extra_workspace_slot", {
    p_event_id: checkoutSessionId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export function entitlementJson(e: WorkspaceCreateEntitlement) {
  return {
    can_create_workspace: e.canCreate,
    extra_workspace_slots: e.extraSlots,
    owned_workspace_count: e.ownedCount,
    workspace_allowance: e.allowance,
    extra_workspace_price_usd: EXTRA_WORKSPACE_PRICE_USD,
    unlimited_workspaces: e.unlimited,
  };
}
