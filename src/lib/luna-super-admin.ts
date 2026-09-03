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
import {
  listVerticalPacks,
  listVerticalLunaPacks,
} from "@/lib/verticals/registry";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CRM_SURFACES = [
  "contacts",
  "invoices",
  "tasks",
  "projects",
  "contracts",
  "pipeline",
  "forms",
  "workflows",
] as const;

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

function envFlag(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
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
    return inspectArchitecture(str(args, "target_component"));
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

async function inspectArchitecture(
  target: string | null
): Promise<ToolResult> {
  const key = (target ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "database_schema" || key === "schema") {
    return {
      ok: true,
      summary:
        "Shared CRM surfaces are contacts, invoices, tasks, projects, contracts, pipeline, forms, and workflows. Vertical packs add their own ops screens. SQL, columns, and RLS are not available through Luna.",
      crm_surfaces: [...CRM_SURFACES],
    };
  }

  if (key === "vertical_registry" || key === "registry") {
    const packs = listVerticalPacks().map((p) => ({
      id: p.id,
      sector: p.sector ?? null,
      presets: [...p.presets],
      nav: p.nav.map((n) => n.label),
    }));
    const lunaPacks = listVerticalLunaPacks();
    const lines = packs.map((p) => {
      const presetNote = p.presets.length
        ? p.presets.join(", ")
        : "all presets in its sector";
      return `${p.id} for ${presetNote}`;
    });
    const toolLines = lunaPacks.map(
      (p) => `${p.name} with ${p.toolCount} Luna tools`
    );
    return {
      ok: true,
      summary:
        (lines.length
          ? `Installed nav packs: ${lines.join(". ")}.`
          : "No vertical nav packs are registered.") +
        (toolLines.length ? ` Tool packs: ${toolLines.join(". ")}.` : ""),
      packs,
      luna_packs: lunaPacks,
    };
  }

  const admin = createAdminClient();

  if (key === "active_workspaces" || key === "workspaces") {
    const { data: workspaces, error } = await admin
      .from("workspaces")
      .select("id, name, industry_preset, industry_custom_label")
      .order("name", { ascending: true })
      .limit(80);
    if (error) return { error: "Could not list workspaces." };
    const rows = workspaces ?? [];
    const names = rows.map((w: { name?: string }) =>
      typeof w.name === "string" && w.name.trim() ? w.name.trim() : "Untitled"
    );
    const spoken = names.slice(0, 12).join(", ");
    return {
      ok: true,
      summary: rows.length
        ? `${rows.length} workspace${rows.length === 1 ? "" : "s"}${spoken ? `: ${spoken}` : ""}.`
        : "No workspaces yet.",
      workspaces: rows.map(
        (w: {
          id?: string;
          name?: string;
          industry_preset?: string | null;
          industry_custom_label?: string | null;
        }) => ({
          id: typeof w.id === "string" ? w.id : "",
          name:
            typeof w.name === "string" && w.name.trim() ? w.name.trim() : "Untitled",
          industry: industryDisplayLabel(
            w.industry_preset,
            w.industry_custom_label
          ),
        })
      ),
    };
  }

  if (key === "system_telemetry" || key === "telemetry" || key === "health") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [ws, members, activity] = await Promise.all([
      admin.from("workspaces").select("id", { count: "exact", head: true }),
      admin.from("workspace_members").select("id", { count: "exact", head: true }),
      admin
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
    ]);
    const workspaceCount = ws.count ?? 0;
    const memberCount = members.count ?? 0;
    const activityCount = activity.count ?? 0;
    return {
      ok: true,
      summary: `${workspaceCount} workspaces, ${memberCount} memberships, ${activityCount} activity events in the last day. Gemini ${envFlag("GEMINI_API_KEY") || envFlag("GOOGLE_API_KEY") ? "is" : "is not"} configured. Simli ${envFlag("SIMLI_API_KEY") ? "is" : "is not"} configured.`,
      workspace_count: workspaceCount,
      membership_count: memberCount,
      activity_last_day: activityCount,
      integrations: {
        gemini: envFlag("GEMINI_API_KEY") || envFlag("GOOGLE_API_KEY"),
        simli: envFlag("SIMLI_API_KEY"),
        elevenlabs: envFlag("ELEVENLABS_API_KEY"),
        stripe: envFlag("STRIPE_SECRET_KEY"),
        resend: envFlag("RESEND_API_KEY"),
      },
    };
  }

  return {
    error:
      "Choose vertical_registry, database_schema, active_workspaces, or system_telemetry.",
  };
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
