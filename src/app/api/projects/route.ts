import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/projects?workspaceId=...
 * Lists projects for the workspace, including linked contact and task counts.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { supabase, workspaceId } = auth;
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*, contact:contacts(*)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (projects ?? []).map((p) => p.id);
  const counts: Record<string, { total: number; open: number }> = {};
  if (ids.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("project_id, status")
      .eq("workspace_id", workspaceId)
      .in("project_id", ids);
    for (const t of tasks ?? []) {
      if (!t.project_id) continue;
      const c = (counts[t.project_id] ??= { total: 0, open: 0 });
      c.total += 1;
      if (t.status !== "done") c.open += 1;
    }
  }

  const withCounts = (projects ?? []).map((p) => ({
    ...p,
    task_count: counts[p.id]?.total ?? 0,
    open_task_count: counts[p.id]?.open ?? 0,
  }));

  return NextResponse.json({ projects: withCounts });
}

/**
 * POST /api/projects
 * Creates a project in the given workspace.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body;
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const payload = {
    workspace_id: auth.workspaceId,
    name,
    description: body.description ?? null,
    status: body.status ?? "planning",
    contact_id: body.contact_id ?? null,
    lead_id: body.lead_id ?? null,
    start_date: body.start_date ?? null,
    due_date: body.due_date ?? null,
    budget: body.budget ?? null,
    currency: body.currency ?? "USD",
  };

  const { data, error } = await auth.supabase
    .from("projects")
    .insert(payload)
    .select("*, contact:contacts(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ project: data }, { status: 201 });
}
