import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { SERVICE_PLAN_FREQUENCIES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("service_plans", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "name",
    "contact_id",
    "project_id",
    "next_visit_on",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (typeof body.frequency === "string" &&
    (SERVICE_PLAN_FREQUENCIES as readonly string[]).includes(body.frequency)
  ) {
    update.frequency = body.frequency;
  }
  if ("seasonal_on" in body) update.seasonal_on = Boolean(body.seasonal_on);
  if ("is_active" in body) update.is_active = Boolean(body.is_active);
  if ("auto_invoice" in body) update.auto_invoice = Boolean(body.auto_invoice);
  if ("amount" in body) update.amount = Number(body.amount) || 0;
  const { data, error } = await authed.supabase
    .from("service_plans")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("service_plans", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("service_plans")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
