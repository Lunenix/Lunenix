import { NextRequest, NextResponse } from "next/server";
import { isIanaTimeZone, sanitizeCustomInstructions } from "@/lib/luna";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";

const DEFAULT_SETTINGS = {
  agent_name: "Luna",
  avatar_id: "avatar_1",
  avatar_url: null as string | null,
  voice_id: "ava",
  home_city: null as string | null,
  timezone: null as string | null,
  custom_instructions: null as string | null,
};

/**
 * GET /api/workspaces/ai-settings?workspaceId=...
 * Returns the workspace's Luna AI settings, or sensible defaults if none exist.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const authed = await requireWorkspaceMember(workspaceId);
  if ("error" in authed) return authed.error;
  const { supabase } = authed;

  const { data, error } = await supabase
    .from("workspace_ai_settings")
    .select("*")
    .eq("workspace_id", authed.workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = data ?? {
    workspace_id: authed.workspaceId,
    ...DEFAULT_SETTINGS,
  };

  return NextResponse.json({ settings });
}

/**
 * POST /api/workspaces/ai-settings
 * Upserts the workspace's Luna AI settings.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const workspaceId: string = (body.workspace_id ?? "").trim();
  const authed = await requireWorkspaceMember(workspaceId);
  if ("error" in authed) return authed.error;
  const { supabase } = authed;

  const homeCityRaw =
    typeof body.home_city === "string" ? body.home_city.trim().slice(0, 80) : "";
  const tzRaw =
    typeof body.timezone === "string" ? body.timezone.trim() : "";

  const payload = {
    workspace_id: authed.workspaceId,
    agent_name: (body.agent_name ?? DEFAULT_SETTINGS.agent_name).trim() ||
      DEFAULT_SETTINGS.agent_name,
    avatar_id: body.avatar_id ?? DEFAULT_SETTINGS.avatar_id,
    voice_id: body.voice_id ?? DEFAULT_SETTINGS.voice_id,
    avatar_url: body.avatar_url ?? null,
    home_city: homeCityRaw || null,
    timezone: tzRaw && isIanaTimeZone(tzRaw) ? tzRaw : null,
    custom_instructions: sanitizeCustomInstructions(body.custom_instructions),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("workspace_ai_settings")
    .upsert(payload, { onConflict: "workspace_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
