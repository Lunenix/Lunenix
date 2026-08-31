import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/emails/inbound/unread-count?workspaceId=...
 * Lightweight count of unread inbound emails for the sidebar badge.
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
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const { count, error } = await supabase
    .from("inbound_emails")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("is_read", false);

  if (error) {
    // Table may not exist yet (migration not applied) — fail soft with 0.
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count || 0 });
}
