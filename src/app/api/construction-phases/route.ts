import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { DELAY_CAUSES, PHASE_KINDS, PHASE_STATUSES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("construction_phases")
    .select("*, project:projects(id, name), sub:construction_subs(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("starts_on", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phases: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const kind = (PHASE_KINDS as readonly string[]).includes(body.kind)
    ? body.kind
    : "finish";
  const status = (PHASE_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "planned";
  const delay_cause = (DELAY_CAUSES as readonly string[]).includes(
    body.delay_cause
  )
    ? body.delay_cause
    : null;
  const { data, error } = await auth.supabase
    .from("construction_phases")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      sub_id: body.sub_id || null,
      kind,
      status,
      percent_complete: Number(body.percent_complete) || 0,
      delay_cause,
      depends_on:
        typeof body.depends_on === "string"
          ? body.depends_on.trim() || null
          : null,
      starts_on: body.starts_on || null,
      ends_on: body.ends_on || null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phase: data }, { status: 201 });
}
