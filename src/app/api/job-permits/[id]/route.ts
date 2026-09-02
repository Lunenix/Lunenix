import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { PERMIT_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("job_permits", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "name",
    "permit_number",
    "project_id",
    "contact_id",
    "notes",
    "pulled_on",
    "approved_on",
    "inspection_on",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (typeof body.status === "string" && (PERMIT_STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status;
    const today = new Date().toISOString().slice(0, 10);
    if (body.status === "pulled" && !body.pulled_on) update.pulled_on = today;
    if (
      (body.status === "approved" || body.status === "passed") &&
      !body.approved_on
    ) {
      update.approved_on = today;
    }
  }
  const { data, error } = await authed.supabase
    .from("job_permits")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ permit: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("job_permits", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("job_permits")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
