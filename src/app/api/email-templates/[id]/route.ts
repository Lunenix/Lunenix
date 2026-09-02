import { NextRequest, NextResponse } from "next/server";
import type { EmailTemplate } from "@/types/database";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/email-templates/[id]
 * Fetch a single email template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("email_templates", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { data: template, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    console.error("Error fetching email template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: template as EmailTemplate });
}

/**
 * PATCH /api/email-templates/[id]
 * Update an email template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("email_templates", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;
  const body = await request.json();

  const updates: Partial<EmailTemplate> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.body !== undefined) updates.body = body.body;
  if (body.variables !== undefined) updates.variables = body.variables;

  const { data: template, error } = await supabase
    .from("email_templates")
    .update(updates)
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    console.error("Error updating email template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: template as EmailTemplate });
}

/**
 * DELETE /api/email-templates/[id]
 * Delete an email template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("email_templates", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  // System default templates are used by automations and cannot be deleted.
  const { data: existing } = await supabase
    .from("email_templates")
    .select("is_system_default")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  if (existing?.is_system_default) {
    return NextResponse.json(
      { error: "System default templates cannot be deleted." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("Error deleting email template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
