import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { DELAY_CAUSES, PHASE_KINDS, PHASE_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("construction_phases", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "sub_id",
    "percent_complete",
    "depends_on",
    "starts_on",
    "ends_on",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.kind === "string" &&
    (PHASE_KINDS as readonly string[]).includes(body.kind)
  ) {
    update.kind = body.kind;
  }
  if (
    typeof body.status === "string" &&
    (PHASE_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }
  if (body.delay_cause === "" || body.delay_cause === null) {
    update.delay_cause = null;
  } else if (
    typeof body.delay_cause === "string" &&
    (DELAY_CAUSES as readonly string[]).includes(body.delay_cause)
  ) {
    update.delay_cause = body.delay_cause;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("construction_phases")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name), sub:construction_subs(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phase: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("construction_phases", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("construction_phases")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
