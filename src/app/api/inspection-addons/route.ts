import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { ADDON_KINDS, ADDON_STATUSES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("inspection_addons")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ addons: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const kind = (ADDON_KINDS as readonly string[]).includes(body.kind)
    ? body.kind
    : "other";
  const status = (ADDON_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "ordered";
  const { data, error } = await auth.supabase
    .from("inspection_addons")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      kind,
      status,
      specialist_name:
        typeof body.specialist_name === "string"
          ? body.specialist_name.trim() || null
          : null,
      result_summary:
        typeof body.result_summary === "string"
          ? body.result_summary.trim() || null
          : null,
      due_on: body.due_on || null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ addon: data }, { status: 201 });
}
