import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { MAINT_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("rental_maintenance", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "asset_id",
    "title",
    "hours_at_service",
    "cost",
    "due_on",
    "completed_on",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.status === "string" &&
    (MAINT_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
    if (body.status === "complete" && !update.completed_on) {
      update.completed_on = new Date().toISOString().slice(0, 10);
    }
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("rental_maintenance")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, asset:rental_assets(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data.asset_id && data.status === "complete") {
    await authed.supabase
      .from("rental_assets")
      .update({
        status: "available",
        location: "yard",
        last_serviced_on: data.completed_on,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.asset_id)
      .eq("workspace_id", authed.workspaceId);
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("rental_maintenance", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("rental_maintenance")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
