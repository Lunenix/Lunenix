import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_SETTINGS = {
  agent_name: "Luna",
  avatar_id: "avatar_1",
  avatar_url: null as string | null,
  voice_id: "ava",
};

/**
 * GET /api/workspaces/ai-settings?workspaceId=...
 * Returns the workspace's Luna AI settings, or sensible defaults if none exist.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("workspace_ai_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return defaults when no row exists yet.
  const settings = data ?? { workspace_id: workspaceId, ...DEFAULT_SETTINGS };

  return NextResponse.json({ settings });
}

/**
 * POST /api/workspaces/ai-settings
 * Upserts the workspace's Luna AI settings.
 * Body: { workspace_id, agent_name, avatar_id, voice_id, avatar_url? }
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const workspaceId: string = (body.workspace_id ?? "").trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspace_id is required" },
      { status: 400 }
    );
  }

  const payload = {
    workspace_id: workspaceId,
    agent_name: (body.agent_name ?? DEFAULT_SETTINGS.agent_name).trim() ||
      DEFAULT_SETTINGS.agent_name,
    avatar_id: body.avatar_id ?? DEFAULT_SETTINGS.avatar_id,
    voice_id: body.voice_id ?? DEFAULT_SETTINGS.voice_id,
    avatar_url: body.avatar_url ?? null,
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
