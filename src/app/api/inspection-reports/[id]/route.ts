import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { REPORT_STATUSES } from "@/lib/fieldService";

function stampForStatus(status: string): Record<string, string> {
  const now = new Date().toISOString();
  if (status === "ready") return { ready_at: now };
  if (status === "sent") return { sent_at: now };
  if (status === "viewed") return { viewed_at: now };
  if (status === "downloaded") return { downloaded_at: now };
  return {};
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("inspection_reports", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "contact_id",
    "title",
    "summary",
    "agent_name",
    "seller_agent_name",
    "property_type",
    "property_size",
    "closing_on",
    "due_at",
    "walkthrough_at",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (
    typeof body.status === "string" &&
    (REPORT_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
    Object.assign(update, stampForStatus(body.status));
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("inspection_reports")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("inspection_reports", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("inspection_reports")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
