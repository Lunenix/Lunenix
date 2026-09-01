import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/tasks?workspaceId=...&projectId=...
 * Lists tasks. Always scoped to a workspace the caller belongs to.
 */
export async function GET(request: NextRequest) {
  const requestedWorkspaceId = request.nextUrl.searchParams.get("workspaceId");
  const projectId = request.nextUrl.searchParams.get("projectId");

  let workspaceId = requestedWorkspaceId;

  if (!workspaceId && projectId) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: project } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project?.workspace_id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    workspaceId = project.workspace_id;
  }

  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  let query = auth.supabase
    .from("tasks")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tasks: data });
}

/**
 * POST /api/tasks
 * Creates a task.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title } = body;
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  let countQuery = auth.supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId);
  if (body.project_id) countQuery = countQuery.eq("project_id", body.project_id);
  const { count } = await countQuery;

  const status = body.status ?? "todo";
  const payload = {
    workspace_id: auth.workspaceId,
    project_id: body.project_id ?? null,
    title,
    description: body.description ?? null,
    status,
    priority: body.priority ?? "medium",
    assignee_id: body.assignee_id ?? null,
    due_date: body.due_date ?? null,
    position: count ?? 0,
    completed_at: status === "done" ? new Date().toISOString() : null,
  };

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert(payload)
    .select("*, project:projects(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ task: data }, { status: 201 });
}
