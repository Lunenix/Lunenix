import { NextRequest, NextResponse } from "next/server";
import type { EmailLog } from "@/types/database";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/emails/logs?workspaceId=...&contactId=...&status=...
 * Fetch email logs for a workspace with optional filters
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const contactId = request.nextUrl.searchParams.get("contactId");
  const status = request.nextUrl.searchParams.get("status");

  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  let query = auth.supabase
    .from("email_logs")
    .select(
      `
      *,
      contact:contacts(id, first_name, last_name, organization_name, email, type),
      template:email_templates(id, name)
    `
    )
    .eq("workspace_id", auth.workspaceId);

  if (contactId) {
    query = query.eq("contact_id", contactId);
  }
  if (status) {
    query = query.eq("status", status);
  }

  query = query.order("sent_at", { ascending: false });

  const { data: logs, error } = await query;

  if (error) {
    console.error("Error fetching email logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: logs as EmailLog[] });
}
