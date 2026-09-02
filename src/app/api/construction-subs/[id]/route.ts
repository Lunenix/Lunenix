import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { SUB_TRADES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("construction_subs", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "name",
    "phone",
    "email",
    "coi_expires",
    "license_expires",
    "rate_notes",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.trade === "string" &&
    (SUB_TRADES as readonly string[]).includes(body.trade)
  ) {
    update.trade = body.trade;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("construction_subs")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sub: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("construction_subs", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("construction_subs")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
