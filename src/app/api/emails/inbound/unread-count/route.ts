import { NextRequest, NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/emails/inbound/unread-count?workspaceId=...
 * Lightweight count of unread inbound emails for the sidebar badge.
 */
export async function GET(request: NextRequest) {
  const access = await verifyWorkspaceAccess(request);
  if (access.errorResponse) return access.errorResponse;

  const { count, error } = await access.supabase
    .from("inbound_emails")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", access.workspaceId)
    .eq("is_read", false);

  if (error) {
    // Table may not exist yet (migration not applied) — fail soft with 0.
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count || 0 });
}
