import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord(
    "construction_daily_logs",
    params.id
  );
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "logged_on",
    "weather",
    "crew_notes",
    "work_completed",
    "issues",
    "safety_notes",
    "photo_url",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  const { data, error } = await authed.supabase
    .from("construction_daily_logs")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, project:projects(id, name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord(
    "construction_daily_logs",
    params.id
  );
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("construction_daily_logs")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
