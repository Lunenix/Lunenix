import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncWorkspaceInbox } from "@/lib/email/imapSync";

// IMAP + mailparser need the Node.js runtime (not edge).
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/emails/inbound/sync
 * Trigger an on-demand IMAP sync for a workspace ("Sync now").
 * Body: { workspaceId }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = body.workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  // Verify the user is a member of the workspace (RLS-backed check).
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncWorkspaceInbox(workspaceId);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, imported: result.imported },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
