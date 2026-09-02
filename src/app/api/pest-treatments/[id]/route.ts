import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { TREATMENT_METHODS, TREATMENT_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("pest_treatments", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "contact_id",
    "product_name",
    "epa_number",
    "quantity",
    "target_pest",
    "treatment_area",
    "treated_on",
    "retreatment_until",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (typeof body.method === "string" && (TREATMENT_METHODS as readonly string[]).includes(body.method)) {
    update.method = body.method;
  }
  if (typeof body.status === "string" && (TREATMENT_STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status;
  }
  if ("guarantee_days" in body) {
    update.guarantee_days =
      body.guarantee_days === "" || body.guarantee_days == null
        ? null
        : Number(body.guarantee_days);
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("pest_treatments")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ treatment: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("pest_treatments", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("pest_treatments")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
