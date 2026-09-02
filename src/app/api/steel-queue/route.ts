import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { STEEL_FAB_STEPS, STEEL_STAGES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("steel_queue")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ queue: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const stage = (STEEL_STAGES as readonly string[]).includes(body.stage)
    ? body.stage
    : "design_approved";
  const fab_step = (STEEL_FAB_STEPS as readonly string[]).includes(body.fab_step)
    ? body.fab_step
    : null;
  const { data, error } = await auth.supabase
    .from("steel_queue")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      title,
      stage,
      fab_step,
      fabricator_name:
        typeof body.fabricator_name === "string"
          ? body.fabricator_name.trim() || null
          : null,
      install_on: body.install_on || null,
      access_notes:
        typeof body.access_notes === "string"
          ? body.access_notes.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
