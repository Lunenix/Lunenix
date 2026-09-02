import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { HOA_COLOR_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("hoa_color_approvals", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of ["project_id", "contact_id", "scheme_notes", "notes"]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (typeof body.status === "string" && (HOA_COLOR_STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status;
    const today = new Date().toISOString().slice(0, 10);
    if (body.status === "submitted" && !body.submitted_on) update.submitted_on = today;
    if (
      (body.status === "approved" || body.status === "denied") &&
      !body.decided_on
    ) {
      update.decided_on = today;
    }
  }
  if ("submitted_on" in body) update.submitted_on = body.submitted_on || null;
  if ("decided_on" in body) update.decided_on = body.decided_on || null;
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("hoa_color_approvals")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approval: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("hoa_color_approvals", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("hoa_color_approvals")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
