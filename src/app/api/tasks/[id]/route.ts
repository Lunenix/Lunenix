import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { parseReminderMinutes } from "@/lib/tasks/reminder";

/**
 * PATCH /api/tasks/[id]
 * Updates a task. Handles status toggling with completed_at bookkeeping.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowed = [
    "title",
    "description",
    "status",
    "priority",
    "assignee_id",
    "due_date",
    "reminder_minutes_before",
    "position",
    "project_id",
    "contact_id",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if ("contact_id" in update && !update.contact_id) {
    update.contact_id = null;
  }

  if ("reminder_minutes_before" in body) {
    const reminder = parseReminderMinutes(body.reminder_minutes_before);
    if (!reminder.ok) {
      return NextResponse.json({ error: reminder.error }, { status: 400 });
    }
    update.reminder_minutes_before = reminder.value;
    update.reminder_sent_at = null;
  }
  if ("due_date" in body) {
    update.reminder_sent_at = null;
  }

  // Fetch old task to detect completion
  const { data: oldTask } = await supabase
    .from("tasks")
    .select("status, workspace_id")
    .eq("id", params.id)
    .single();

  // Keep completed_at in sync with status changes.
  if ("status" in body) {
    update.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }

  if ("contact_id" in update && update.contact_id) {
    const { data: client } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", update.contact_id)
      .eq("workspace_id", oldTask?.workspace_id)
      .maybeSingle();
    if (!client?.id) {
      return NextResponse.json(
        { error: "That contact is not in this workspace." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", params.id)
    .select(
      "*, project:projects(id, name), contact:contacts(id, type, first_name, last_name, organization_name, email)"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Trigger automation workflows if task was just completed
  if (data && oldTask && "status" in update && 
      oldTask.status !== "done" && data.status === "done") {
    executeWorkflowsForTrigger("task_completed", {
      task_id: data.id,
      task: data,
      project_id: data.project_id,
      user_id: user.id,
    }, data.workspace_id).catch((err) => {
      console.error("Error executing task_completed workflows:", err);
    });
  }
  
  return NextResponse.json({ task: data });
}

/**
 * DELETE /api/tasks/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("tasks").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
