import { NextRequest, NextResponse } from "next/server";
import type { AutomationWorkflow } from "@/types/database";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/automation-workflows/[id]
 * Fetch a single automation workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("automation_workflows", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { data: workflow, error } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    console.error("Error fetching automation workflow:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflow: workflow as AutomationWorkflow });
}

/**
 * PATCH /api/automation-workflows/[id]
 * Update an automation workflow
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("automation_workflows", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;
  const body = await request.json();

  const updates: Partial<AutomationWorkflow> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.trigger_type !== undefined) updates.trigger_type = body.trigger_type;
  if (body.trigger_config !== undefined) updates.trigger_config = body.trigger_config;
  if (body.actions !== undefined) updates.actions = body.actions;

  const { data: workflow, error } = await supabase
    .from("automation_workflows")
    .update(updates)
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    console.error("Error updating automation workflow:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflow: workflow as AutomationWorkflow });
}

/**
 * DELETE /api/automation-workflows/[id]
 * Delete an automation workflow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("automation_workflows", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { error } = await supabase
    .from("automation_workflows")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("Error deleting automation workflow:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
