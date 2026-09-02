import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { STEEL_DRAWING_STATUSES, STEEL_PE_STATUSES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("steel_drawings")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drawings: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const status = (STEEL_DRAWING_STATUSES as readonly string[]).includes(
    body.status
  )
    ? body.status
    : "draft";
  const pe_status = (STEEL_PE_STATUSES as readonly string[]).includes(
    body.pe_status
  )
    ? body.pe_status
    : "not_required";
  const { data, error } = await auth.supabase
    .from("steel_drawings")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      title,
      version: Number(body.version) || 1,
      status,
      pe_status,
      dimensions:
        typeof body.dimensions === "string"
          ? body.dimensions.trim() || null
          : null,
      weld_notes:
        typeof body.weld_notes === "string"
          ? body.weld_notes.trim() || null
          : null,
      drawing_url:
        typeof body.drawing_url === "string"
          ? body.drawing_url.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drawing: data }, { status: 201 });
}
