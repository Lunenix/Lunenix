import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { PAINT_SHEENS } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("job_finish_specs", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "contact_id",
    "room_or_surface",
    "brand",
    "color_name",
    "color_code",
    "quantity",
    "supplier",
    "match_notes",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if ("sheen" in body) {
    update.sheen = (PAINT_SHEENS as readonly string[]).includes(body.sheen)
      ? body.sheen
      : null;
  }
  if ("client_signed_off_at" in body) {
    update.client_signed_off_at = body.client_signed_off_at || null;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("job_finish_specs")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spec: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("job_finish_specs", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("job_finish_specs")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
