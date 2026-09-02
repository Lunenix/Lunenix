import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { STEEL_FINISHES, STEEL_METALS } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_specs", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "name",
    "project_id",
    "thickness",
    "cost",
    "quote_valid_until",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.metal === "string" &&
    (STEEL_METALS as readonly string[]).includes(body.metal)
  ) {
    update.metal = body.metal;
  }
  if (
    typeof body.finish === "string" &&
    (STEEL_FINISHES as readonly string[]).includes(body.finish)
  ) {
    update.finish = body.finish;
  }
  if (body.signed_off === true) {
    update.signed_off_at = new Date().toISOString();
  }
  if (body.signed_off === false) {
    update.signed_off_at = null;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("steel_specs")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spec: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_specs", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("steel_specs")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
