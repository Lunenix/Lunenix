import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { HOA_COLOR_STATUSES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId");
  let q = auth.supabase
    .from("hoa_color_approvals")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approvals: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const status = (HOA_COLOR_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "needed";
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await auth.supabase
    .from("hoa_color_approvals")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      status,
      scheme_notes:
        typeof body.scheme_notes === "string"
          ? body.scheme_notes.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      submitted_on:
        body.submitted_on || (status === "submitted" ? today : null),
      decided_on:
        body.decided_on ||
        (status === "approved" || status === "denied" ? today : null),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approval: data }, { status: 201 });
}
