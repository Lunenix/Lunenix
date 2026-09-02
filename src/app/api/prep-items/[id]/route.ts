import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { PREP_KINDS, PREP_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("job_prep_items", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of ["project_id", "contact_id", "notes"]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (typeof body.kind === "string" && (PREP_KINDS as readonly string[]).includes(body.kind)) {
    update.kind = body.kind;
  }
  if (typeof body.status === "string" && (PREP_STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status;
  }
  if ("billed_separately" in body) {
    update.billed_separately = Boolean(body.billed_separately);
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("job_prep_items")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("job_prep_items", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("job_prep_items")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
