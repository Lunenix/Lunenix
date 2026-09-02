import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import {
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  FINDING_SYSTEMS,
} from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("inspection_findings", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "contact_id",
    "title",
    "notes",
    "moisture_reading",
    "thermal_notes",
    "photo_url",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (
    typeof body.system === "string" &&
    (FINDING_SYSTEMS as readonly string[]).includes(body.system)
  ) {
    update.system = body.system;
  }
  if (
    typeof body.severity === "string" &&
    (FINDING_SEVERITIES as readonly string[]).includes(body.severity)
  ) {
    update.severity = body.severity;
  }
  if (
    typeof body.status === "string" &&
    (FINDING_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("inspection_findings")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ finding: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("inspection_findings", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("inspection_findings")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
