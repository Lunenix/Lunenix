import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import { ensureSuperAdminMembership } from "@/lib/supabase/grantSuperAdminWorkspaces";

/**
 * PATCH /api/workspaces/[id]
 * Renames a workspace. Only owners/admins of the workspace may rename it.
 * Body: { name }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workspaceId = params.id;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name: string = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Verify the user is an owner/admin of this workspace before allowing rename.
  const { data: membership, error: memberErr } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (memberErr || !membership) {
    if (isSuperAdmin(user)) {
      try {
        await ensureSuperAdminMembership(
          createAdminClient(),
          user.id,
          workspaceId
        );
      } catch {
        return NextResponse.json(
          { error: "You are not a member of this workspace" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "You are not a member of this workspace" },
        { status: 403 }
      );
    }
  }

  const role = membership?.role;
  if (!isSuperAdmin(user) && !["owner", "admin"].includes(role ?? "")) {
    return NextResponse.json(
      { error: "Only owners and admins can rename this workspace" },
      { status: 403 }
    );
  }

  // Use the admin client for the update so it is not blocked by RLS.
  const admin = createAdminClient();
  const { data: workspace, error: updateErr } = await admin
    .from("workspaces")
    .update({ name })
    .eq("id", workspaceId)
    .select("*")
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ workspace });
}
