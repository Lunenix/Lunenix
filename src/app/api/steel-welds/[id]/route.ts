import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { NDT_RESULTS, WELD_RESULTS, WELD_TYPES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_weld_logs", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of ["welder_name", "project_id", "joint", "notes"]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.weld_type === "string" &&
    (WELD_TYPES as readonly string[]).includes(body.weld_type)
  ) {
    update.weld_type = body.weld_type;
  }
  if (
    typeof body.result === "string" &&
    (WELD_RESULTS as readonly string[]).includes(body.result)
  ) {
    update.result = body.result;
  }
  if (
    typeof body.ndt_result === "string" &&
    (NDT_RESULTS as readonly string[]).includes(body.ndt_result)
  ) {
    update.ndt_result = body.ndt_result;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("steel_weld_logs")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ weld: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_weld_logs", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("steel_weld_logs")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
