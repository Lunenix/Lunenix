import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/workspaces
 * Creates a workspace and adds the current user as owner.
 * Body: { name, slug? }
 *
 * Uses the service-role (admin) client for the inserts so workspace creation
 * is not blocked by row-level security (the previous authenticated-client
 * insert failed the workspaces RLS policy). The user is still authenticated
 * first via the cookie-based client, so only logged-in users can create.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const body = await request.json();
  const name: string = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const industryPreset: string | null =
    typeof body.industry_preset === "string" && body.industry_preset.trim()
      ? body.industry_preset.trim()
      : null;

  const slug: string =
    (body.slug ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // Ensure slug uniqueness with a short random suffix if needed.
  const uniqueSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: workspace, error: wErr } = await admin
    .from("workspaces")
    .insert({
      name,
      slug: uniqueSlug,
      tier: "free_beta",
      max_seats: 5,
      industry_preset: industryPreset,
    })
    .select("*")
    .single();

  if (wErr) {
    return NextResponse.json({ error: wErr.message }, { status: 500 });
  }

  // Build the membership list: always the creator as owner.
  const memberRows: { workspace_id: string; user_id: string; role: string }[] =
    [{ workspace_id: workspace.id, user_id: user.id, role: "owner" }];

  // Auto-grant every super-admin owner access to the new workspace, so the
  // platform "master key" account can see and manage all workspaces.
  try {
    const { data: userList } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of userList?.users ?? []) {
      const isSuper =
        (u.app_metadata as { is_super_admin?: boolean } | null)
          ?.is_super_admin === true;
      if (isSuper && u.id !== user.id) {
        memberRows.push({
          workspace_id: workspace.id,
          user_id: u.id,
          role: "owner",
        });
      }
    }
  } catch {
    // If listing users fails, still proceed with the creator membership.
  }

  const { error: mErr } = await admin
    .from("workspace_members")
    .insert(memberRows);

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  // Seed default pipeline stages for the chosen industry preset. Non-fatal:
  // the workspace is already created, so we don't fail the request if seeding
  // hits an issue.
  try {
    await admin.rpc("seed_pipeline_stages", {
      p_workspace_id: workspace.id,
      p_preset: industryPreset ?? "general",
    });
  } catch (e) {
    console.error("seed_pipeline_stages failed:", e);
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
