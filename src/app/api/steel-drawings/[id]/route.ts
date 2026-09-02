import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { STEEL_DRAWING_STATUSES, STEEL_PE_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_drawings", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "title",
    "project_id",
    "contact_id",
    "version",
    "dimensions",
    "weld_notes",
    "drawing_url",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.status === "string" &&
    (STEEL_DRAWING_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }
  if (
    typeof body.pe_status === "string" &&
    (STEEL_PE_STATUSES as readonly string[]).includes(body.pe_status)
  ) {
    update.pe_status = body.pe_status;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("steel_drawings")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drawing: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_drawings", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("steel_drawings")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
