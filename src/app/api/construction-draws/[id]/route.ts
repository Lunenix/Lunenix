import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import {
  DRAW_KINDS,
  DRAW_STATUSES,
  LIEN_WAIVER_STATUSES,
} from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("construction_draws", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "amount",
    "percent_complete",
    "due_on",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.kind === "string" &&
    (DRAW_KINDS as readonly string[]).includes(body.kind)
  ) {
    update.kind = body.kind;
  }
  if (
    typeof body.status === "string" &&
    (DRAW_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }
  if (
    typeof body.lien_waiver === "string" &&
    (LIEN_WAIVER_STATUSES as readonly string[]).includes(body.lien_waiver)
  ) {
    update.lien_waiver = body.lien_waiver;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("construction_draws")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draw: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("construction_draws", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("construction_draws")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
