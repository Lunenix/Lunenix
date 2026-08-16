/**
 * Action Handlers for Automation Workflows
 * Each handler executes a specific automation action
 */

import { createAdminClient } from "@/lib/supabase/server";
import { sendServerEmail } from "@/lib/email/sendServerEmail";
import type { AutomationAction } from "@/types/database";

// Automation runs from trusted server contexts (including public routes such
// as form submission and contract signing), so it uses the admin client to
// bypass RLS. Access is always scoped by an explicit workspace_id.
async function getSupabaseClient() {
  return createAdminClient();
}

/**
 * Replace variables in a string with actual values
 * Supports: {{contact.name}}, {{contact.email}}, {{workspace.name}}, etc.
 */
function replaceVariables(
  template: string,
  context: Record<string, unknown>
): string {
  let result = template;
  
  // Match all {{variable}} patterns
  const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
  
  matches.forEach((match) => {
    const key = match.replace(/\{\{|\}\}/g, "").trim();
    const keys = key.split(".");
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = context;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    
    if (value !== undefined && value !== null) {
      result = result.replace(match, String(value));
    }
  });
  
  return result;
}

/**
 * Send Email Action
 * Sends an email using a template or direct content
 */
export async function handleSendEmailAction(
  action: AutomationAction,
  context: {
    workspace_id: string;
    contact?: unknown;
    user?: unknown;
    workspace?: unknown;
    [key: string]: unknown;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { template_id, to, subject, body } = action.config;
    
    const supabase = await getSupabaseClient();
    
    let finalSubject = subject as string;
    let finalBody = body as string;
    let recipientEmail = to as string;
    
    // Replace variables in recipient email
    if (recipientEmail && typeof recipientEmail === "string") {
      recipientEmail = replaceVariables(recipientEmail, context);
    }
    
    // If template_id is provided, fetch and use the template
    if (template_id) {
      const { data: template } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      
      if (template) {
        finalSubject = replaceVariables(template.subject, context);
        finalBody = replaceVariables(template.body, context);
      }
    } else {
      // Replace variables in subject and body
      if (subject && typeof subject === "string") {
        finalSubject = replaceVariables(subject, context);
      }
      if (body && typeof body === "string") {
        finalBody = replaceVariables(body, context);
      }
    }
    
    // Type assertions for context properties
    const contactData = context.contact as { id?: string; first_name?: string; company_name?: string } | undefined;

    if (!recipientEmail) {
      return { success: false, error: "No recipient email resolved" };
    }

    // Send the email directly server-side (works from public/unauthenticated
    // trigger contexts, bypassing the auth-gated /api/emails/send route).
    const result = await sendServerEmail({
      workspaceId: context.workspace_id,
      to: recipientEmail,
      toName: contactData?.first_name || contactData?.company_name || null,
      contactId: contactData?.id || null,
      templateId: (template_id as string) || null,
      subject: finalSubject,
      html: finalBody,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Failed to send email" };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Create Task Action
 * Creates a new task in the workspace
 */
export async function handleCreateTaskAction(
  action: AutomationAction,
  context: {
    workspace_id: string;
    contact?: unknown;
    project?: unknown;
    user?: unknown;
    [key: string]: unknown;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { title, description, due_days, project_id, assigned_to } = action.config;
    
    const supabase = await getSupabaseClient();
    
    // Type assertions for context properties
    const projectData = context.project as { id?: string } | undefined;
    
    // Replace variables in title and description
    const finalTitle = (title && typeof title === "string") 
      ? replaceVariables(title, context) 
      : "New Task";
    const finalDescription = (description && typeof description === "string") 
      ? replaceVariables(description, context) 
      : null;
    
    // Calculate due date if due_days is provided
    let dueDate = null;
    if (due_days && typeof due_days === "number") {
      const date = new Date();
      date.setDate(date.getDate() + due_days);
      dueDate = date.toISOString();
    }
    
    // Create the task
    const { error } = await supabase.from("tasks").insert({
      workspace_id: context.workspace_id,
      project_id: project_id || projectData?.id || null,
      title: finalTitle,
      description: finalDescription,
      due_date: dueDate,
      assigned_to: assigned_to || null,
      status: "pending",
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update Contact Action
 * Updates contact fields
 */
export async function handleUpdateContactAction(
  action: AutomationAction,
  context: {
    workspace_id: string;
    contact?: unknown;
    [key: string]: unknown;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { contact_id, updates } = action.config;
    
    // Type assertions for context properties
    const contactData = context.contact as { id?: string } | undefined;
    
    if (!contact_id && !contactData?.id) {
      return { success: false, error: "No contact ID provided" };
    }
    
    const supabase = await getSupabaseClient();
    
    const finalContactId = contact_id || contactData?.id || "";
    
    // Process updates and replace variables
    const processedUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries((updates as Record<string, unknown>) || {})) {
      if (typeof value === "string") {
        processedUpdates[key] = replaceVariables(value, context);
      } else {
        processedUpdates[key] = value;
      }
    }
    
    // Update the contact
    const { error } = await supabase
      .from("contacts")
      .update(processedUpdates)
      .eq("id", finalContactId)
      .eq("workspace_id", context.workspace_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Move Lead Action
 * Moves a lead to a different pipeline stage
 */
export async function handleMoveLeadAction(
  action: AutomationAction,
  context: {
    workspace_id: string;
    lead?: unknown;
    [key: string]: unknown;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { lead_id, stage_id } = action.config;
    
    // Type assertions for context properties
    const leadData = context.lead as { id?: string } | undefined;
    
    if (!lead_id && !leadData?.id) {
      return { success: false, error: "No lead ID provided" };
    }
    
    if (!stage_id) {
      return { success: false, error: "No target stage ID provided" };
    }
    
    const supabase = await getSupabaseClient();
    
    const finalLeadId = lead_id || leadData?.id || "";
    
    // Update the lead's stage
    const { error } = await supabase
      .from("leads")
      .update({ stage_id })
      .eq("id", finalLeadId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Delay Action
 * Waits for a specified duration (in minutes)
 * Note: This is a placeholder - real implementation would use a queue/scheduler
 */
export async function handleDelayAction(
  action: AutomationAction
): Promise<{ success: boolean; error?: string }> {
  try {
    const { minutes } = action.config;
    
    if (!minutes || typeof minutes !== "number") {
      return { success: false, error: "Invalid delay duration" };
    }
    
    // In a real implementation, this would:
    // 1. Store the workflow state in a queue
    // 2. Schedule the next action execution for later
    // 3. Return immediately
    
    // For now, we'll just log and continue
    console.log(`Delay action: ${minutes} minutes (not implemented)`);
    
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
