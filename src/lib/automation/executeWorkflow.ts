/**
 * Workflow Execution Engine
 * Executes automation workflows when triggers fire
 */

import { createAdminClient } from "@/lib/supabase/server";
import type {
  AutomationWorkflow,
  AutomationTriggerType,
  AutomationAction,
} from "@/types/database";
import {
  handleSendEmailAction,
  handleSendTelegramAction,
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
    const supabase = createAdminClient();
    
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
 * Execute one specific workflow by id, regardless of its trigger type.
 * Used for "assigned workflows" that a document explicitly starts on signing.
 */
export async function executeWorkflowById(
  workflowId: string,
  triggerData: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: workflow, error } = await supabase
      .from("automation_workflows")
      .select("*")
      .eq("id", workflowId)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !workflow) return;
    await executeWorkflow(workflow as AutomationWorkflow, triggerData);
  } catch (err) {
    console.error("Error executing workflow by id:", err);
  }
}

/**
 * Execute a single workflow
 */
async function executeWorkflow(
  workflow: AutomationWorkflow,
  triggerData: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  
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
  if (workflow.trigger_type === "form_submission") {
    // 1) Optionally restrict to a specific form.
    if (config.form_id && triggerData.form_id !== config.form_id) {
      return false;
    }

    // 2) Optionally restrict to a specific answer to one field
    //    (e.g. a dropdown/radio/checkbox choice the client picked).
    if (config.field_id) {
      const submitted =
        (triggerData.submitted_data as Record<string, unknown>) ?? {};
      const answer = submitted[config.field_id as string];
      const operator = (config.operator as string) || "equals";

      // Normalise the submitted answer to an array of strings so that
      // single-select (string) and multi-select (string[]) fields compare
      // the same way.
      const answerValues: string[] = Array.isArray(answer)
        ? answer.map((a) => String(a))
        : answer === undefined || answer === null || answer === ""
        ? []
        : [String(answer)];

      // "any" (or no expected value) -> fire when the field was answered.
      if (
        operator === "any" ||
        config.value === undefined ||
        config.value === null ||
        config.value === ""
      ) {
        return answerValues.length > 0;
      }

      const expected = String(config.value).toLowerCase();
      const normalised = answerValues.map((v) => v.toLowerCase());

      if (operator === "not_equals") {
        return !normalised.includes(expected);
      }
      if (operator === "contains") {
        return normalised.some((v) => v.includes(expected));
      }
      // default: equals (the picked option matches exactly)
      return normalised.includes(expected);
    }

    return true;
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
  const supabase = createAdminClient();
  
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
  
  // For form submissions, expose the answers by their human-readable field
  // label so actions can personalise ({{form.name}}, {{form.answers.<label>}}).
  if (triggerData.form_id) {
    const { data: form } = await supabase
      .from("forms")
      .select("id, name, fields")
      .eq("id", triggerData.form_id as string)
      .maybeSingle();

    if (form) {
      const submitted =
        (triggerData.submitted_data as Record<string, unknown>) ?? {};
      const answersByLabel: Record<string, string> = {};
      const fields = (form.fields as { id: string; label: string }[]) || [];
      for (const f of fields) {
        const raw = submitted[f.id];
        if (raw === undefined || raw === null) continue;
        answersByLabel[f.label] = Array.isArray(raw)
          ? raw.map((v) => String(v)).join(", ")
          : String(raw);
      }
      context.form = {
        id: form.id,
        name: form.name,
        answers: answersByLabel,
      };
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
  
  // Get current user from trigger data (admin client has no auth session).
  if (triggerData.user_id) {
    const { data: userRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", triggerData.user_id as string)
      .maybeSingle();
    if (userRow) {
      const row = userRow as Record<string, unknown>;
      context.user = {
        id: row.id,
        email: row.email ?? null,
        name: row.full_name ?? row.email ?? null,
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

      case "send_telegram":
        return await handleSendTelegramAction(action, ctx);
      
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
