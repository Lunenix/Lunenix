import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailLog } from "@/types/database";

/**
 * GET /api/emails/logs?workspaceId=...&contactId=...&status=...
 * Fetch email logs for a workspace with optional filters
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const contactId = searchParams.get("contactId");
  const status = searchParams.get("status");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("email_logs")
    .select(
      `
      *,
      contact:contacts(id, first_name, last_name, organization_name, email, type),
      template:email_templates(id, name)
    `
    )
    .eq("workspace_id", workspaceId);

  // Apply optional filters
  if (contactId) {
    query = query.eq("contact_id", contactId);
  }
  if (status) {
    query = query.eq("status", status);
  }

  query = query.order("sent_at", { ascending: false });

  const { data: logs, error } = await supabase.auth.getUser().then(() => query);

  if (error) {
    console.error("Error fetching email logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: logs as EmailLog[] });
}
