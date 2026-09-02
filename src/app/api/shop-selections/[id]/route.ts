import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { SHOP_SELECTION_KINDS } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("shop_selections", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of ["name", "project_id", "cost", "photo_url", "notes"]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.kind === "string" &&
    (SHOP_SELECTION_KINDS as readonly string[]).includes(body.kind)
  ) {
    update.kind = body.kind;
  }
  if (body.signed_off === true) {
    update.signed_off_at = new Date().toISOString();
  }
  if (body.signed_off === false) {
    update.signed_off_at = null;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("shop_selections")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ selection: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("shop_selections", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("shop_selections")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
