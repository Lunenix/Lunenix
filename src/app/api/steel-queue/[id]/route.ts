import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { STEEL_FAB_STEPS, STEEL_STAGES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_queue", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "title",
    "project_id",
    "contact_id",
    "fabricator_name",
    "install_on",
    "access_notes",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.stage === "string" &&
    (STEEL_STAGES as readonly string[]).includes(body.stage)
  ) {
    update.stage = body.stage;
  }
  if (body.fab_step === null || body.fab_step === "") {
    update.fab_step = null;
  } else if (
    typeof body.fab_step === "string" &&
    (STEEL_FAB_STEPS as readonly string[]).includes(body.fab_step)
  ) {
    update.fab_step = body.fab_step;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("steel_queue")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("steel_queue", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("steel_queue")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
