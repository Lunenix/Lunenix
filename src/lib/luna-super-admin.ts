import "server-only";

import { isIanaTimeZone, sanitizeCustomInstructions } from "@/lib/luna";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import {
  INDUSTRY_PRESETS,
  INDUSTRY_SECTORS,
  industryDisplayLabel,
  industrySectorId,
  industrySectorLabel,
  isIndustryPreset,
  normalizeIndustryCustomLabel,
  resolveIndustryPreset,
} from "@/lib/industryVerticals";
import { seedIndustryDefaultWorkflows } from "@/lib/automation/hvacDefaultWorkflows";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ensureSuperAdminMembership,
  grantMissingSuperAdminMemberships,
} from "@/lib/supabase/grantSuperAdminWorkspaces";
import {
  CUSTOM_INDUSTRY_PRESET,
  TEAM_SIZE_OPTIONS,
  WORKSPACE_TIER_ADMIN,
  isTeamSize,
  seatsForTeamSize,
} from "@/lib/workspace";
import { inspectSystemArchitecture } from "@/lib/luna-super-admin-inspect";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (relation: string) => any };
type ToolResult = Record<string, unknown>;
type ToolRunner = (
  supabase: Db,
  workspaceId: string,
  userId: string,
  name: string,
  args: Record<string, unknown>
) => Promise<ToolResult>;

function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function resolveCatalogPreset(raw: string): string | null {
  const trimmed = raw.trim();
  const mapped = resolveIndustryPreset(trimmed);
  if (mapped && isIndustryPreset(mapped)) return mapped;
  const lower = trimmed.toLowerCase();
  const exact = INDUSTRY_PRESETS.find(
    (p) => p.value === lower || p.label.toLowerCase() === lower
  );
  if (exact) return exact.value;
  const loose = INDUSTRY_PRESETS.filter(
    (p) =>
      p.label.toLowerCase().includes(lower) ||
      p.value.replace(/_/g, " ").includes(lower)
  );
  return loose.length === 1 ? loose[0].value : null;
}

async function requirePlatformOwner(userId: string): Promise<ToolResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || !isSuperAdmin(data.user)) {
    return { error: "Those admin tools are only for the platform owner." };
  }
  return null;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  let page = 1;
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (!users.length) return null;
    const hit = users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < 200) return null;
    page += 1;
  }
}

export async function executeSuperAdminLunaTool(
  supabase: Db,
  workspaceId: string,
  userId: string,
  name: string,
  args: Record<string, unknown>,
  runWorkspaceTool: ToolRunner
): Promise<ToolResult | null> {
  if (
    name !== "admin_inspect_system_architecture" &&
    name !== "admin_provision_workspace" &&
    name !== "admin_execute_cross_workspace_action"
  ) {
    return null;
  }

  const denied = await requirePlatformOwner(userId);
  if (denied) return denied;

  if (name === "admin_inspect_system_architecture") {
    return inspectSystemArchitecture(
      createAdminClient(),
      str(args, "target_component") ?? ""
    );
  }
  if (name === "admin_provision_workspace") {
    return provisionWorkspace(userId, args);
  }
  return executeCrossWorkspace(
    supabase,
    workspaceId,
    userId,
    args,
    runWorkspaceTool
  );
}

async function provisionWorkspace(
  actorUserId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const workspaceName = str(args, "workspace_name");
  const ownerEmail = str(args, "owner_email");
  const industryCategory = str(args, "industry_category");
  if (!workspaceName || !ownerEmail || !industryCategory) {
    return {
      error: "Need a workspace name, owner email, and industry from the catalog.",
    };
  }
  if (!ownerEmail.includes("@")) {
    return { error: "Owner email does not look valid." };
  }

  const preset = resolveCatalogPreset(industryCategory);
  if (!preset) {
    return {
      error:
        "That industry is not in the catalog. Use a listed vertical such as HVAC or Mobile Bartending.",
    };
  }

  const group = str(args, "industry_group");
  if (group) {
    const expected = industrySectorLabel(preset);
    const groupLower = group.trim().toLowerCase();
    const sectorHit = INDUSTRY_SECTORS.find(
      (s) =>
        s.label.toLowerCase() === groupLower ||
        s.id === groupLower.replace(/\s+/g, "_")
    );
    if (sectorHit && industrySectorId(preset) !== sectorHit.id) {
      return {
        error: `${industryDisplayLabel(preset)} belongs to ${expected}, not ${sectorHit.label}.`,
      };
    }
    if (
      !sectorHit &&
      expected &&
      !expected.toLowerCase().includes(groupLower) &&
      !groupLower.includes(expected.toLowerCase())
    ) {
      return {
        error: `${industryDisplayLabel(preset)} is in ${expected}.`,
      };
    }
  }

  let customLabel: string | null = null;
  if (preset === CUSTOM_INDUSTRY_PRESET) {
    customLabel = normalizeIndustryCustomLabel(
      str(args, "industry_custom_label") ?? group ?? industryCategory
    );
    if (!customLabel) {
      return { error: "Other workspaces need a short custom business label." };
    }
  }

  const teamSizeRaw = str(args, "team_size") ?? "1-5";
  const teamSize = isTeamSize(teamSizeRaw) ? teamSizeRaw : TEAM_SIZE_OPTIONS[0].value;
  const phone = str(args, "phone");

  const ownerId = await findUserIdByEmail(ownerEmail);
  if (!ownerId) {
    return {
      error: `No Lunenix account for ${ownerEmail}. They need to sign up before I can make them owner.`,
    };
  }

  const admin = createAdminClient();
  const slugSource = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
  const uniqueSlug = `${slugSource}-${Math.random().toString(36).slice(2, 6)}`;

  const insertRow: Record<string, unknown> = {
    name: workspaceName.slice(0, 120),
    slug: uniqueSlug,
    tier: WORKSPACE_TIER_ADMIN,
    max_seats: seatsForTeamSize(teamSize),
    industry_preset: preset,
    team_size: teamSize,
    trial_ends_at: null,
  };
  if (phone) insertRow.phone = phone.slice(0, 40);
  if (customLabel) insertRow.industry_custom_label = customLabel;

  const { data: workspace, error: wErr } = await admin
    .from("workspaces")
    .insert(insertRow)
    .select("id, name")
    .single();
  if (wErr || !workspace?.id) {
    return { error: wErr?.message ?? "Could not create that workspace." };
  }

  const memberIds = new Set<string>([actorUserId, ownerId]);
  try {
    const { data: userList } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of userList?.users ?? []) {
      if (isSuperAdmin(u)) memberIds.add(u.id);
    }
  } catch {
    /* still insert actor + owner */
  }

  const { error: mErr } = await admin.from("workspace_members").insert(
    Array.from(memberIds).map((id) => ({
      workspace_id: workspace.id,
      user_id: id,
      role: "owner",
    }))
  );
  if (mErr) {
    return { error: mErr.message ?? "Workspace created but membership failed." };
  }

  try {
    await grantMissingSuperAdminMemberships(admin);
  } catch {
    /* memberships already include this actor */
  }

  try {
    await admin.rpc("seed_pipeline_stages", {
      p_workspace_id: workspace.id,
      p_preset: preset,
    });
  } catch (e) {
    console.error("seed_pipeline_stages failed:", e);
  }
  try {
    await seedIndustryDefaultWorkflows(admin, workspace.id);
  } catch (e) {
    console.error("seedIndustryDefaultWorkflows failed:", e);
  }

  const label = industryDisplayLabel(preset, customLabel);
  return {
    ok: true,
    workspace_id: workspace.id,
    summary: `Created ${workspace.name} as ${label}. ${ownerEmail} is an owner.`,
  };
}

async function executeCrossWorkspace(
  supabase: Db,
  currentWorkspaceId: string,
  userId: string,
  args: Record<string, unknown>,
  runWorkspaceTool: ToolRunner
): Promise<ToolResult> {
  const targetId = str(args, "target_workspace_id");
  const action = (str(args, "action_type") ?? "").toLowerCase();
  const payload = asObject(args.payload);
  if (!targetId || !UUID_RE.test(targetId)) {
    return { error: "Need a valid target workspace id." };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("workspaces")
    .select("id, name")
    .eq("id", targetId)
    .maybeSingle();
  if (!target?.id) {
    return { error: "That workspace was not found." };
  }

  try {
    await ensureSuperAdminMembership(admin, userId, target.id);
  } catch {
    return { error: "Could not join that workspace." };
  }

  if (action === "set_ai_settings") {
    return setAiSettings(supabase, target.id, payload);
  }

  let toolName: string | null = null;
  if (action === "manage_contact") {
    const looksCreate =
      str(payload, "action") === "create" ||
      ((str(payload, "first_name") ||
        str(payload, "name") ||
        str(payload, "organization_name")) &&
        !str(payload, "contact_name") &&
        !str(payload, "lookup") &&
        !str(payload, "current_name"));
    toolName = looksCreate ? "create_contact" : "update_contact";
  } else if (action === "update_invoice") {
    toolName = "update_invoice";
  } else if (action === "reassign_task") {
    toolName = "update_task";
  }

  if (!toolName) {
    return {
      error:
        "Action must be manage_contact, update_invoice, reassign_task, or set_ai_settings.",
    };
  }

  const result = await runWorkspaceTool(
    supabase,
    target.id,
    userId,
    toolName,
    payload
  );
  const wsName =
    typeof target.name === "string" && target.name.trim()
      ? target.name.trim()
      : "that workspace";
  if (result.error) return result;
  const prior =
    typeof result.summary === "string" ? result.summary : "Done.";
  const next: ToolResult = {
    ...result,
    summary: `${prior} That was in ${wsName}.`,
  };
  if (currentWorkspaceId !== target.id) next.target_workspace = wsName;
  return next;
}

async function setAiSettings(
  supabase: Db,
  workspaceId: string,
  payload: Record<string, unknown>
): Promise<ToolResult> {
  const homeCityRaw = str(payload, "home_city");
  const tzRaw = str(payload, "timezone");
  const agentName = str(payload, "agent_name");
  const instructions = sanitizeCustomInstructions(payload.custom_instructions);

  const { data: existing } = await supabase
    .from("workspace_ai_settings")
    .select("agent_name, home_city, timezone, custom_instructions")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const row = {
    workspace_id: workspaceId,
    agent_name: agentName || existing?.agent_name || "Luna",
    avatar_id: "avatar_1",
    voice_id: "ava",
    home_city: homeCityRaw ?? existing?.home_city ?? null,
    timezone:
      tzRaw && isIanaTimeZone(tzRaw)
        ? tzRaw
        : (typeof existing?.timezone === "string" ? existing.timezone : null),
    custom_instructions:
      instructions ??
      (typeof existing?.custom_instructions === "string"
        ? existing.custom_instructions
        : null),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("workspace_ai_settings")
    .upsert(row, { onConflict: "workspace_id" });
  if (error) return { error: error.message ?? "Could not update AI settings." };
  return {
    ok: true,
    summary: "Updated Luna settings for that workspace. Tone only; security rules stay.",
  };
}
