import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { SHOP_DESIGN_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("shop_designs", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "title",
    "project_id",
    "contact_id",
    "version",
    "dimensions",
    "joinery_notes",
    "drawing_url",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.status === "string" &&
    (SHOP_DESIGN_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("shop_designs")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ design: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("shop_designs", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("shop_designs")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
