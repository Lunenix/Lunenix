import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * PATCH /api/leads/[id]
 * Updates a lead — used for drag-and-drop (stage_id + position) and edits.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("leads", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, user, workspaceId, recordId } = authed;

  const body = await request.json();
  const allowed = [
    "stage_id",
    "position",
    "title",
    "value",
    "currency",
    "notes",
    "contact_id",
    "expected_close_date",
    "source",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const { data: oldLead } = await supabase
    .from("leads")
    .select("stage_id, workspace_id")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select("*, contact:contacts(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (
    data &&
    oldLead &&
    "stage_id" in update &&
    oldLead.stage_id !== data.stage_id
  ) {
    executeWorkflowsForTrigger(
      "lead_stage_change",
      {
        lead_id: data.id,
        lead: data,
        from_stage_id: oldLead.stage_id,
        to_stage_id: data.stage_id,
        contact_id: data.contact_id,
        user_id: user.id,
      },
      workspaceId
    ).catch((err) => {
      console.error("Error executing lead_stage_change workflows:", err);
    });
  }

  return NextResponse.json({ lead: data });
}

/**
 * DELETE /api/leads/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("leads", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
