import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { parseReminderMinutes } from "@/lib/tasks/reminder";

/**
 * GET /api/tasks?workspaceId=...&projectId=...
 * Lists tasks. Always scoped to a workspace the caller belongs to.
 * Project detail may pass only projectId; membership is taken from that project.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  let supabase;
  let workspaceId: string;

  if (!searchParams.get("workspaceId") && projectId) {
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: project } = await client
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project?.workspace_id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const member = await requireWorkspaceMember(project.workspace_id);
    if ("error" in member) return member.error;
    supabase = member.supabase;
    workspaceId = member.workspaceId;
  } else {
    const auth = await verifyWorkspaceAccess(request);
    if (auth.errorResponse) return auth.errorResponse;
    supabase = auth.supabase;
    workspaceId = auth.workspaceId;
  }

  let query = supabase
    .from("tasks")
    .select(
      "*, project:projects(id, name), contact:contacts(id, type, first_name, last_name, organization_name, email)"
    )
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (projectId) query = query.eq("project_id", projectId);

  const { data: tasks, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tasks: tasks ?? [] });
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

  const reminder = parseReminderMinutes(body.reminder_minutes_before);
  if (!reminder.ok) {
    return NextResponse.json({ error: reminder.error }, { status: 400 });
  }
  const reminderMinutes = reminder.value;
  if (reminderMinutes && !body.due_date) {
    return NextResponse.json(
      { error: "Set a due date to use a reminder." },
      { status: 400 }
    );
  }

  let countQuery = auth.supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId);
  if (body.project_id) countQuery = countQuery.eq("project_id", body.project_id);
  const { count } = await countQuery;

  const contactId: string | null = body.contact_id ?? null;
  if (contactId) {
    const { data: client } = await auth.supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!client?.id) {
      return NextResponse.json(
        { error: "That contact is not in this workspace." },
        { status: 400 }
      );
    }
  }

  const status = body.status ?? "todo";
  const payload = {
    workspace_id: auth.workspaceId,
    project_id: body.project_id ?? null,
    contact_id: contactId,
    title,
    description: body.description ?? null,
    status,
    priority: body.priority ?? "medium",
    assignee_id: body.assignee_id ?? auth.user.id,
    due_date: body.due_date ?? null,
    reminder_minutes_before: reminderMinutes,
    reminder_sent_at: null,
    position: count ?? 0,
    completed_at: status === "done" ? new Date().toISOString() : null,
  };

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert(payload)
    .select(
      "*, project:projects(id, name), contact:contacts(id, type, first_name, last_name, organization_name, email)"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ task: data }, { status: 201 });
}
