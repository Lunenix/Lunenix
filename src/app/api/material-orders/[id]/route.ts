import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import {
  MATERIAL_ORDER_STATUSES,
  MATERIAL_TYPES,
} from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("material_orders", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "name",
    "project_id",
    "contact_id",
    "color",
    "quantity",
    "vendor",
    "delivery_on",
    "dropoff_notes",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (
    typeof body.status === "string" &&
    (MATERIAL_ORDER_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }
  if (
    typeof body.material_type === "string" &&
    (MATERIAL_TYPES as readonly string[]).includes(body.material_type)
  ) {
    update.material_type = body.material_type;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("material_orders")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("material_orders", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("material_orders")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
