import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailTemplate } from "@/types/database";
import { verifyWorkspaceAccess } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/email-templates?workspaceId=...
 * Fetch all email templates for a workspace
 */
export async function GET(request: NextRequest) {
  const access = await verifyWorkspaceAccess(request);
  if ("errorResponse" in access) return access.errorResponse;

  const { data: templates, error } = await access.supabase
    .from("email_templates")
    .select("*")
    .eq("workspace_id", access.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: templates as EmailTemplate[] });
}

/**
 * POST /api/email-templates
 * Create a new email template
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
  const { workspace_id, name, subject, body: emailBody, variables } = body;

  if (!workspace_id || !name || !subject || !emailBody) {
    return NextResponse.json(
      { error: "workspace_id, name, subject, and body are required" },
      { status: 400 }
    );
  }

  const { data: template, error } = await supabase
    .from("email_templates")
    .insert({
      workspace_id,
      name,
      subject,
      body: emailBody,
      variables: variables || [],
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating email template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: template as EmailTemplate });
}
