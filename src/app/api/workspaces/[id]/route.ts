import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import {
  CUSTOM_INDUSTRY_PRESET,
  isIndustryPreset,
  normalizeIndustryCustomLabel,
} from "@/lib/workspace";

/**
 * PATCH /api/workspaces/[id]
 * Update name and/or industry for one workspace. Owners and admins only.
 * Body: { name?, industry_preset?, industry_custom_label? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireWorkspaceMember(params.id);
  if ("error" in auth) return auth.error;

  const { data: membership } = await auth.supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", auth.workspaceId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (
    !isSuperAdmin(auth.user) &&
    !["owner", "admin"].includes(membership?.role ?? "")
  ) {
    return NextResponse.json(
      { error: "Only owners and admins can update this workspace" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }
    updates.name = name;
  }

  if (typeof body.industry_preset === "string") {
    const preset = body.industry_preset.trim();
    if (!preset || !isIndustryPreset(preset)) {
      return NextResponse.json(
        { error: "Choose an industry." },
        { status: 400 }
      );
    }
    const custom =
      preset === CUSTOM_INDUSTRY_PRESET
        ? normalizeIndustryCustomLabel(
            typeof body.industry_custom_label === "string"
              ? body.industry_custom_label
              : null
          )
        : null;
    if (preset === CUSTOM_INDUSTRY_PRESET && !custom) {
      return NextResponse.json(
        { error: "Describe your business type for Other." },
        { status: 400 }
      );
    }
    updates.industry_preset = preset;
    if (custom) {
      updates.industry_custom_label = custom;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: workspace, error: updateErr } = await admin
    .from("workspaces")
    .update(updates)
    .eq("id", auth.workspaceId)
    .select("*")
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ workspace });
}
