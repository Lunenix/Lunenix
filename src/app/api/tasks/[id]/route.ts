import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    "position",
    "project_id",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  // Keep completed_at in sync with status changes.
  if ("status" in body) {
    update.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", params.id)
    .select("*, project:projects(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
