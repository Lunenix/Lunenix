import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/projects/[id]
 * Returns a single project with its linked contact.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("projects", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { data, error } = await supabase
    .from("projects")
    .select("*, contact:contacts(*)")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ project: data });
}

/**
 * PATCH /api/projects/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("projects", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const body = await request.json();
  const allowed = [
    "name",
    "description",
    "status",
    "contact_id",
    "lead_id",
    "start_date",
    "due_date",
    "budget",
    "currency",
    "assignee_id",
    "address",
    "urgent",
    "estimate_id",
    "route_position",
    "weather_hold",
    "weather_hold_reason",
    "work_phase",
    "inspection_phase",
    "closing_on",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select("*, contact:contacts(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ project: data });
}

/**
 * DELETE /api/projects/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("projects", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
