import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import { ensureSuperAdminMembership } from "@/lib/supabase/grantSuperAdminWorkspaces";

type Authed = {
  supabase: ReturnType<typeof createClient>;
  user: User;
  workspaceId: string;
};

/**
 * Auth + tenant check for API routes.
 * 401 if unsigned-in, 400 if workspace id missing, 403 if not a member.
 */
export async function requireWorkspaceMember(
  workspaceId: string | null | undefined
): Promise<Authed | { error: NextResponse }> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const id = typeof workspaceId === "string" ? workspaceId.trim() : "";
  if (!id) {
    return {
      error: NextResponse.json(
        { error: "workspaceId parameter is required" },
        { status: 400 }
      ),
    };
  }

  const { data: membership, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (memberError || !membership) {
    if (isSuperAdmin(user)) {
      try {
        await ensureSuperAdminMembership(createAdminClient(), user.id, id);
      } catch (e) {
        console.error("ensureSuperAdminMembership failed:", e);
        return {
          error: NextResponse.json(
            { error: "Forbidden: Access denied to workspace" },
            { status: 403 }
          ),
        };
      }
      return { supabase, user, workspaceId: id };
    }
    return {
      error: NextResponse.json(
        { error: "Forbidden: Access denied to workspace" },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, workspaceId: id };
}

const WORKSPACE_SCOPED_TABLES = new Set([
  "contacts",
  "tasks",
  "projects",
  "invoices",
  "contracts",
  "leads",
  "forms",
  "email_templates",
  "automation_workflows",
  "estimates",
  "inventory_items",
  "vendor_bills",
  "job_expenses",
  "customer_equipment",
  "technician_profiles",
  "mileage_logs",
  "job_permits",
  "service_plans",
  "insurance_claims",
  "material_orders",
  "job_finish_specs",
  "job_prep_items",
  "hoa_color_approvals",
  "pest_treatments",
  "property_access",
  "inspection_findings",
  "inspection_reports",
  "inspection_addons",
  "rental_assets",
  "rental_reservations",
  "rental_condition_logs",
  "rental_maintenance",
  "construction_change_orders",
  "construction_subs",
  "construction_phases",
  "construction_daily_logs",
  "construction_draws",
  "shop_designs",
  "shop_selections",
  "shop_queue",
  "steel_drawings",
  "steel_specs",
  "steel_queue",
  "steel_weld_logs",
]);

/**
 * Load a tenant row by id, then require membership on its workspace_id.
 * Always pair later writes with `.eq("workspace_id", workspaceId)`.
 */
export async function requireWorkspaceRecord(
  table: string,
  recordId: string | null | undefined
): Promise<(Authed & { recordId: string }) | { error: NextResponse }> {
  if (!WORKSPACE_SCOPED_TABLES.has(table)) {
    return {
      error: NextResponse.json({ error: "Invalid resource" }, { status: 400 }),
    };
  }
  const id = typeof recordId === "string" ? recordId.trim() : "";
  if (!id) {
    return {
      error: NextResponse.json({ error: "Record id is required" }, { status: 400 }),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data } = await supabase
    .from(table)
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();

  let workspaceId =
    data && typeof data.workspace_id === "string" ? data.workspace_id : null;

  if (!workspaceId && isSuperAdmin(user)) {
    const { data: row } = await createAdminClient()
      .from(table)
      .select("workspace_id")
      .eq("id", id)
      .maybeSingle();
    workspaceId =
      row && typeof row.workspace_id === "string" ? row.workspace_id : null;
  }

  if (!workspaceId) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const member = await requireWorkspaceMember(workspaceId);
  if ("error" in member) return member;
  return { ...member, recordId: id };
}

export type WorkspaceAuthed = Authed;

/**
 * Auth + membership for GET routes that pass ?workspaceId=...
 * Failures set `errorResponse`; success has supabase, user, workspaceId.
 */
export async function verifyWorkspaceAccess(
  request: Request
): Promise<(Authed & { errorResponse?: undefined }) | { errorResponse: NextResponse }> {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const result = await requireWorkspaceMember(workspaceId);
  if ("error" in result) {
    return { errorResponse: result.error };
  }
  return result;
}
