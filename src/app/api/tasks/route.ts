import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tasks?workspaceId=...&projectId=...
 * Lists tasks. Filters by projectId when provided, otherwise all workspace tasks.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!workspaceId && !projectId) {
    return NextResponse.json(
      { error: "workspaceId or projectId is required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("tasks")
    .select("*, project:projects(id, name)")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (projectId) query = query.eq("project_id", projectId);
  if (workspaceId) query = query.eq("workspace_id", workspaceId);

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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, title } = body;
  if (!workspace_id || !title) {
    return NextResponse.json(
      { error: "workspace_id and title are required" },
      { status: 400 }
    );
  }

  // Determine next position within the project (or workspace inbox).
  let countQuery = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace_id);
  if (body.project_id) countQuery = countQuery.eq("project_id", body.project_id);
  const { count } = await countQuery;

  const status = body.status ?? "todo";
  const payload = {
    workspace_id,
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

  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select("*, project:projects(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ task: data }, { status: 201 });
}
