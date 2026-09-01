import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AutomationWorkflow } from "@/types/database";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/automation-workflows?workspaceId=...
 * Fetch all automation workflows for a workspace
 */
export async function GET(request: NextRequest) {
  const access = await verifyWorkspaceAccess(request);
  if (access.errorResponse) return access.errorResponse;

  const { data: workflows, error } = await access.supabase
    .from("automation_workflows")
    .select("*")
    .eq("workspace_id", access.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching automation workflows:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflows: workflows as AutomationWorkflow[] });
}

/**
 * POST /api/automation-workflows
 * Create a new automation workflow
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    workspace_id,
    name,
    description,
    is_active,
    trigger_type,
    trigger_config,
    actions,
  } = body;

  if (!workspace_id || !name || !trigger_type || !actions) {
    return NextResponse.json(
      {
        error:
          "workspace_id, name, trigger_type, and actions are required",
      },
      { status: 400 }
    );
  }

  const { data: workflow, error } = await supabase
    .from("automation_workflows")
    .insert({
      workspace_id,
      name,
      description: description || null,
      is_active: is_active || false,
      trigger_type,
      trigger_config: trigger_config || {},
      actions: actions || [],
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating automation workflow:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflow: workflow as AutomationWorkflow });
}
