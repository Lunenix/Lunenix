import { NextRequest, NextResponse } from "next/server";
import type { AutomationWorkflow } from "@/types/database";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * POST /api/automation-workflows/[id]/toggle
 * Toggle the is_active status of an automation workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("automation_workflows", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { data: currentWorkflow, error: fetchError } = await supabase
    .from("automation_workflows")
    .select("is_active")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  if (fetchError) {
    console.error("Error fetching workflow:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Toggle the is_active state
  const { data: workflow, error } = await supabase
    .from("automation_workflows")
    .update({ is_active: !currentWorkflow.is_active })
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    console.error("Error toggling workflow:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflow: workflow as AutomationWorkflow });
}
