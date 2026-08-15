import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";

/**
 * PATCH /api/leads/[id]
 * Updates a lead — used for drag-and-drop (stage_id + position) and edits.
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
    "stage_id",
    "position",
    "title",
    "value",
    "currency",
    "notes",
    "contact_id",
    "expected_close_date",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  
  // Fetch old lead to detect stage change
  const { data: oldLead } = await supabase
    .from("leads")
    .select("stage_id, workspace_id")
    .eq("id", params.id)
    .single();

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", params.id)
    .select("*, contact:contacts(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Trigger automation workflows if stage changed
  if (data && oldLead && "stage_id" in update && oldLead.stage_id !== data.stage_id) {
    executeWorkflowsForTrigger("lead_stage_change", {
      lead_id: data.id,
      lead: data,
      from_stage_id: oldLead.stage_id,
      to_stage_id: data.stage_id,
      contact_id: data.contact_id,
      user_id: user.id,
    }, data.workspace_id).catch((err) => {
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("leads").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
