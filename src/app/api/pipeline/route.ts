import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

const DEFAULT_STAGES = [
  { name: "New Lead", color: "#6366f1" },
  { name: "Contacted", color: "#0ea5e9" },
  { name: "Qualified", color: "#8b5cf6" },
  { name: "Proposal Sent", color: "#f59e0b" },
  { name: "Won", color: "#22c55e" },
  { name: "Lost", color: "#ef4444" },
];

/**
 * GET /api/pipeline?workspaceId=...
 * Returns the first pipeline for the workspace with its stages and leads.
 * Returns { pipeline: null } if none exists yet.
 */
export async function GET(request: NextRequest) {
  const access = await verifyWorkspaceAccess(request);
  if (access.errorResponse) return access.errorResponse;
  const { supabase, workspaceId } = access;

  const { data: pipelines, error: pErr } = await supabase
    .from("pipelines")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!pipelines || pipelines.length === 0) {
    return NextResponse.json({ pipeline: null, stages: [], leads: [] });
  }

  const pipeline = pipelines[0];
  const archived = request.nextUrl.searchParams.get("archived") === "1";

  const [{ data: stages, error: sErr }, { data: leads, error: lErr }] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipeline.id)
        .order("position", { ascending: true }),
      supabase
        .from("leads")
        .select("*, contact:contacts(*)")
        .eq("pipeline_id", pipeline.id)
        .order("position", { ascending: true }),
    ]);

  if (sErr || lErr) {
    return NextResponse.json(
      { error: sErr?.message || lErr?.message },
      { status: 500 }
    );
  }

  const visible = ((leads ?? []) as Array<{
    archived_at?: string | null;
    contact?: { archived_at?: string | null } | null;
  }>).filter((lead) => {
    const isArchived = Boolean(lead.archived_at) || Boolean(lead.contact?.archived_at);
    return archived ? isArchived : !isArchived;
  });

  return NextResponse.json({ pipeline, stages, leads: visible });
}

/**
 * POST /api/pipeline
 * Creates a default pipeline with 6 stages for the workspace.
 * Body: { workspace_id, name? }
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
  const { workspace_id } = body;
  if (!workspace_id) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  const { data: pipeline, error: pErr } = await supabase
    .from("pipelines")
    .insert({
      workspace_id,
      name: body.name ?? "Sales Pipeline",
      description: body.description ?? null,
    })
    .select("*")
    .single();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const stagesPayload = DEFAULT_STAGES.map((s, i) => ({
    pipeline_id: pipeline.id,
    workspace_id,
    name: s.name,
    color: s.color,
    position: i,
  }));

  const { data: stages, error: sErr } = await supabase
    .from("pipeline_stages")
    .insert(stagesPayload)
    .select("*")
    .order("position", { ascending: true });

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  return NextResponse.json({ pipeline, stages, leads: [] }, { status: 201 });
}
