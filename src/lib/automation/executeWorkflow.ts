/**
 * Workflow Execution Engine
 * Executes automation workflows when triggers fire
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type {
  AutomationWorkflow,
  AutomationTriggerType,
  AutomationAction,
} from "@/types/database";
import {
  handleSendEmailAction,
  handleCreateTaskAction,
  handleUpdateContactAction,
  handleMoveLeadAction,
  handleDelayAction,
} from "./actionHandlers";

/**
 * Execute workflows matching a specific trigger
 */
export async function executeWorkflowsForTrigger(
  triggerType: AutomationTriggerType,
  triggerData: Record<string, unknown>,
  workspaceId: string
): Promise<void> {
  try {
    const supabase = await createServerClient();
    
    // Fetch active workflows for this trigger type and workspace
    const { data: workflows, error } = await supabase
      .from("automation_workflows")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("trigger_type", triggerType)
      .eq("is_active", true);
    
    if (error) {
      console.error("Error fetching workflows:", error);
      return;
    }
    
    if (!workflows || workflows.length === 0) {
      return; // No active workflows for this trigger
    }
    
    // Execute each matching workflow
    for (const workflow of workflows) {
      await executeWorkflow(workflow as AutomationWorkflow, triggerData);
    }
  } catch (err) {
    console.error("Error executing workflows:", err);
  }
}

/**
 * Execute a single workflow
 */
async function executeWorkflow(
  workflow: AutomationWorkflow,
  triggerData: Record<string, unknown>
): Promise<void> {
  const supabase = await createServerClient();
  
  const actionResults: Array<{
    action_type: string;
    status: string;
    error?: string;
  }> = [];
  
  let overallStatus: "success" | "failed" | "partial" = "success";
  let errorMessage: string | null = null;
  
  try {
    // Check if trigger config matches (if specific conditions are set)
    if (!checkTriggerConditions(workflow, triggerData)) {
      console.log(`Workflow ${workflow.id} trigger conditions not met`);
      return; // Skip this workflow
    }
    
    // Build execution context
    const context = await buildExecutionContext(workflow.workspace_id, triggerData);
    
    // Execute actions in sequence
    const actions = (workflow.actions as AutomationAction[]) || [];
    
    for (const action of actions) {
      const result = await executeAction(action, context);
      
      actionResults.push({
        action_type: action.type,
        status: result.success ? "success" : "failed",
        error: result.error,
      });
      
      if (!result.success) {
        overallStatus = overallStatus === "success" ? "partial" : "failed";
      }
    }
    
    // Determine overall status
    const allSuccess = actionResults.every((r) => r.status === "success");
    const allFailed = actionResults.every((r) => r.status === "failed");
    
    if (allSuccess) {
      overallStatus = "success";
    } else if (allFailed) {
      overallStatus = "failed";
      errorMessage = "All actions failed";
    } else {
      overallStatus = "partial";
      errorMessage = "Some actions failed";
    }
  } catch (err) {
    overallStatus = "failed";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Workflow execution error:", err);
  }
  
  // Log the workflow execution
  await supabase.from("automation_logs").insert({
    workflow_id: workflow.id,
    workspace_id: workflow.workspace_id,
    trigger_data: triggerData,
    status: overallStatus,
    error_message: errorMessage,
    action_results: actionResults,
  });
}

/**
 * Check if trigger conditions match
 */
function checkTriggerConditions(
  workflow: AutomationWorkflow,
  triggerData: Record<string, unknown>
): boolean {
  const config = workflow.trigger_config as Record<string, unknown>;
  
  // For form_submission trigger
  if (workflow.trigger_type === "form_submission" && config.form_id) {
    return triggerData.form_id === config.form_id;
  }
  
  // For lead_stage_change trigger
  if (workflow.trigger_type === "lead_stage_change") {
    if (config.from_stage_id && triggerData.from_stage_id !== config.from_stage_id) {
      return false;
    }
    if (config.to_stage_id && triggerData.to_stage_id !== config.to_stage_id) {
      return false;
    }
  }
  
  // For other triggers, accept all by default
  return true;
}

/**
 * Build execution context with all available data
 */
async function buildExecutionContext(
  workspaceId: string,
  triggerData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const supabase = await createServerClient();
  
  const context: Record<string, unknown> = {
    workspace_id: workspaceId,
    ...triggerData,
  };
  
  // Fetch workspace details
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();
  
  if (workspace) {
    context.workspace = workspace;
  }
  
  // Fetch contact if contact_id is provided
  if (triggerData.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", triggerData.contact_id)
      .single();
    
    if (contact) {
      context.contact = contact;
    }
  }
  
  // Fetch lead if lead_id is provided
  if (triggerData.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("*, contact:contacts(*)")
      .eq("id", triggerData.lead_id)
      .single();
    
    if (lead) {
      context.lead = lead;
      if (lead.contact) {
        context.contact = lead.contact;
      }
    }
  }
  
  // Fetch project if project_id is provided
  if (triggerData.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", triggerData.project_id)
      .single();
    
    if (project) {
      context.project = project;
    }
  }
  
  // Get current user (from trigger data or fetch)
  if (triggerData.user_id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      context.user = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
      };
    }
  }
  
  return context;
}

/**
 * Execute a single action
 */
async function executeAction(
  action: AutomationAction,
  context: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = context as any;
    
    switch (action.type) {
      case "send_email":
        return await handleSendEmailAction(action, ctx);
      
      case "create_task":
        return await handleCreateTaskAction(action, ctx);
      
      case "update_contact":
        return await handleUpdateContactAction(action, ctx);
      
      case "move_lead":
        return await handleMoveLeadAction(action, ctx);
      
      case "delay":
        return await handleDelayAction(action);
      
      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
