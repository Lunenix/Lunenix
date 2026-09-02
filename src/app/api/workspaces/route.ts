import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import { grantMissingSuperAdminMemberships } from "@/lib/supabase/grantSuperAdminWorkspaces";
import {
  CUSTOM_INDUSTRY_PRESET,
  EXTRA_WORKSPACE_PRICE_USD,
  WORKSPACE_TIER_ADMIN,
  isIndustryPreset,
  isTeamSize,
  normalizeIndustryCustomLabel,
  seatsForTeamSize,
  trialEndsAt,
} from "@/lib/workspace";
import {
  entitlementJson,
  getWorkspaceCreateEntitlement,
} from "@/lib/billing/workspaceSlots";
import type { WorkspaceWithMembership } from "@/types/database";

const LOGO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function readWorkspacePayload(request: NextRequest): Promise<{
  name: string;
  slug: string;
  industryPreset: string | null;
  industryCustomLabel: string | null;
  phone: string | null;
  teamSize: string | null;
  logo: File | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const logo = form.get("logo");
    return {
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      industryPreset: String(form.get("industry_preset") ?? "").trim() || null,
      industryCustomLabel:
        String(form.get("industry_custom_label") ?? "").trim() || null,
      phone: String(form.get("phone") ?? "").trim() || null,
      teamSize: String(form.get("team_size") ?? "").trim() || null,
      logo: logo instanceof File && logo.size > 0 ? logo : null,
    };
  }
  const body = await request.json();
  return {
    name: String(body.name ?? "").trim(),
    slug: String(body.slug ?? "").trim(),
    industryPreset:
      typeof body.industry_preset === "string"
        ? body.industry_preset.trim() || null
        : null,
    industryCustomLabel:
      typeof body.industry_custom_label === "string"
        ? body.industry_custom_label.trim() || null
        : null,
    phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
    teamSize:
      typeof body.team_size === "string" ? body.team_size.trim() || null : null,
    logo: null,
  };
}

function asWorkspaceListItem(
  ws: Record<string, unknown>,
  role: string
): WorkspaceWithMembership {
  return {
    id: String(ws.id),
    name: String(ws.name ?? ""),
    slug: String(ws.slug ?? ""),
    created_at: String(ws.created_at ?? ""),
    logo_url: typeof ws.logo_url === "string" ? ws.logo_url : null,
    industry_preset:
      typeof ws.industry_preset === "string" ? ws.industry_preset : null,
    industry_custom_label:
      typeof ws.industry_custom_label === "string"
        ? ws.industry_custom_label
        : null,
    phone: typeof ws.phone === "string" ? ws.phone : null,
    team_size: typeof ws.team_size === "string" ? ws.team_size : null,
    max_seats: typeof ws.max_seats === "number" ? ws.max_seats : undefined,
    tier: typeof ws.tier === "string" ? ws.tier : undefined,
    trial_ends_at:
      typeof ws.trial_ends_at === "string" ? ws.trial_ends_at : null,
    membership_role: role,
  };
}

/**
 * GET /api/workspaces
 * Lists workspaces the caller belongs to. Super-admins also receive every
 * workspace they were missing from, without changing existing membership roles.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isSuperAdmin(user)) {
    const admin = createAdminClient();
    try {
      await grantMissingSuperAdminMemberships(admin);
    } catch (e) {
      console.error("grantMissingSuperAdminMemberships failed:", e);
    }
    const { data: workspaces, error } = await admin
      .from("workspaces")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: memberships } = await admin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id);
    const roleById = new Map(
      (memberships ?? []).map((m) => [
        String(m.workspace_id),
        String(m.role ?? "owner"),
      ])
    );
    const list = (workspaces ?? []).map((ws) =>
      asWorkspaceListItem(
        ws as Record<string, unknown>,
        roleById.get(String((ws as { id?: string }).id)) ?? "owner"
      )
    );
    const entitlement = await getWorkspaceCreateEntitlement(admin, user);
    return NextResponse.json({
      workspaces: list,
      ...entitlementJson(entitlement),
    });
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const list: WorkspaceWithMembership[] = (data ?? [])
    .map((row) => {
      const rec = row as unknown as { role?: string; workspaces?: unknown };
      const raw = rec.workspaces;
      const ws = Array.isArray(raw)
        ? (raw[0] as Record<string, unknown> | undefined)
        : (raw as Record<string, unknown> | null | undefined);
      if (!ws || typeof ws.id !== "string") return null;
      return asWorkspaceListItem(ws, rec.role ?? "member");
    })
    .filter((w): w is WorkspaceWithMembership => Boolean(w))
    .sort((a, b) => a.name.localeCompare(b.name));
  const entitlement = await getWorkspaceCreateEntitlement(
    createAdminClient(),
    user
  );
  return NextResponse.json({
    workspaces: list,
    ...entitlementJson(entitlement),
  });
}

/**
 * POST /api/workspaces
 * Creates a workspace and adds the current user as owner.
 * First owned workspace for regular users starts a 21-day trial.
 * Extra owned workspaces require a paid slot and are marked paid.
 * Super-admin creates are admin-tier with no trial.
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
  const entitlement = await getWorkspaceCreateEntitlement(admin, user);
  if (!entitlement.canCreate) {
    return NextResponse.json(
      {
        error: `You already have your included workspace. Additional workspaces are $${EXTRA_WORKSPACE_PRICE_USD} each.`,
        code: "WORKSPACE_SLOT_REQUIRED",
        ...entitlementJson(entitlement),
      },
      { status: 402 }
    );
  }

  const payload = await readWorkspacePayload(request);
  const { name } = payload;
  if (!name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }
  if (!payload.phone) {
    return NextResponse.json({ error: "Company phone is required" }, { status: 400 });
  }
  if (!payload.industryPreset || !isIndustryPreset(payload.industryPreset)) {
    return NextResponse.json({ error: "Choose an industry." }, { status: 400 });
  }
  const industryCustomLabel =
    payload.industryPreset === CUSTOM_INDUSTRY_PRESET
      ? normalizeIndustryCustomLabel(payload.industryCustomLabel)
      : null;
  if (payload.industryPreset === CUSTOM_INDUSTRY_PRESET && !industryCustomLabel) {
    return NextResponse.json(
      { error: "Describe your business type for Other." },
      { status: 400 }
    );
  }
  if (!payload.teamSize || !isTeamSize(payload.teamSize)) {
    return NextResponse.json({ error: "Choose your team size." }, { status: 400 });
  }
  if (payload.logo && payload.logo.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Logo must be 2 MB or smaller." }, { status: 400 });
  }
  if (payload.logo && !LOGO_TYPES[payload.logo.type]) {
    return NextResponse.json(
      { error: "Logo must be a PNG, JPG, WebP, or GIF." },
      { status: 400 }
    );
  }

  const slugSource =
    payload.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const uniqueSlug = `${slugSource}-${Math.random().toString(36).slice(2, 6)}`;
  const platformAdmin = isSuperAdmin(user);
  const extraPaid = !entitlement.unlimited && entitlement.ownedCount > 0;

  const insertRow: Record<string, unknown> = {
    name,
    slug: uniqueSlug,
    tier: platformAdmin
      ? WORKSPACE_TIER_ADMIN
      : extraPaid
        ? "paid"
        : "trial",
    max_seats: seatsForTeamSize(payload.teamSize),
    industry_preset: payload.industryPreset,
    phone: payload.phone.slice(0, 40),
    team_size: payload.teamSize,
    trial_ends_at:
      platformAdmin || extraPaid ? null : trialEndsAt(),
  };
  if (industryCustomLabel) {
    insertRow.industry_custom_label = industryCustomLabel;
  }

  const { data: workspace, error: wErr } = await admin
    .from("workspaces")
    .insert(insertRow)
    .select("*")
    .single();

  if (wErr) {
    return NextResponse.json({ error: wErr.message }, { status: 500 });
  }

  const memberRows: { workspace_id: string; user_id: string; role: string }[] =
    [{ workspace_id: workspace.id, user_id: user.id, role: "owner" }];

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

  let saved = workspace;
  if (payload.logo) {
    const ext = LOGO_TYPES[payload.logo.type];
    const path = `${workspace.id}/logo.${ext}`;
    const bytes = Buffer.from(await payload.logo.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("workspace-assets")
      .upload(path, bytes, {
        contentType: payload.logo.type,
        upsert: true,
      });
    if (!uploadError) {
      const { data: publicUrl } = admin.storage
        .from("workspace-assets")
        .getPublicUrl(path);
      const { data: withLogo } = await admin
        .from("workspaces")
        .update({ logo_url: publicUrl.publicUrl })
        .eq("id", workspace.id)
        .select("*")
        .single();
      if (withLogo) saved = withLogo;
    }
  }

  try {
    await admin.rpc("seed_pipeline_stages", {
      p_workspace_id: workspace.id,
      p_preset: payload.industryPreset,
    });
  } catch (e) {
    console.error("seed_pipeline_stages failed:", e);
  }

  return NextResponse.json({ workspace: saved }, { status: 201 });
}
