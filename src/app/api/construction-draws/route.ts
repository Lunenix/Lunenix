import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  DRAW_KINDS,
  DRAW_STATUSES,
  LIEN_WAIVER_STATUSES,
} from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("construction_draws")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("due_on", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draws: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const kind = (DRAW_KINDS as readonly string[]).includes(body.kind)
    ? body.kind
    : "progress";
  const status = (DRAW_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "draft";
  const lien_waiver = (LIEN_WAIVER_STATUSES as readonly string[]).includes(
    body.lien_waiver
  )
    ? body.lien_waiver
    : "needed";
  const { data, error } = await auth.supabase
    .from("construction_draws")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      kind,
      status,
      amount: Number(body.amount) || 0,
      percent_complete: Number(body.percent_complete) || 0,
      due_on: body.due_on || null,
      lien_waiver,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draw: data }, { status: 201 });
}
