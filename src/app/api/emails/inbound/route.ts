import { NextRequest, NextResponse } from "next/server";
import type { InboundEmail } from "@/types/database";
import { verifyWorkspaceAccess } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/emails/inbound?workspaceId=...
 * List received (inbound) emails for a workspace, newest first.
 */
export async function GET(request: NextRequest) {
  const access = await verifyWorkspaceAccess(request);
  if ("errorResponse" in access) return access.errorResponse;

  const { data, error } = await access.supabase
    .from("inbound_emails")
    .select("*, contact:contacts(*)")
    .eq("workspace_id", access.workspaceId)
    .order("received_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching inbound emails:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ emails: (data || []) as InboundEmail[] });
}
