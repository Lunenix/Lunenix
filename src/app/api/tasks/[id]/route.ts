import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { parseReminderMinutes } from "@/lib/tasks/reminder";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * PATCH /api/tasks/[id]
 * Updates a task. Handles status toggling with completed_at bookkeeping.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("tasks", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, user, workspaceId, recordId } = authed;

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

  const { data: oldTask } = await supabase
    .from("tasks")
    .select("status, workspace_id")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  if ("status" in body) {
    update.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }

  if ("contact_id" in update && update.contact_id) {
    const { data: client } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", update.contact_id)
      .eq("workspace_id", workspaceId)
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
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select(
      "*, project:projects(id, name), contact:contacts(id, type, first_name, last_name, organization_name, email)"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (
    data &&
    oldTask &&
    "status" in update &&
    oldTask.status !== "done" &&
    data.status === "done"
  ) {
    executeWorkflowsForTrigger(
      "task_completed",
      {
        task_id: data.id,
        task: data,
        project_id: data.project_id,
        user_id: user.id,
      },
      workspaceId
    ).catch((err) => {
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
  const authed = await requireWorkspaceRecord("tasks", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
