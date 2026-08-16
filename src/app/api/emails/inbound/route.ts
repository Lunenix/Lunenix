import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { InboundEmail } from "@/types/database";

/**
 * GET /api/emails/inbound?workspaceId=...
 * List received (inbound) emails for a workspace, newest first.
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

  const { data, error } = await supabase
    .from("inbound_emails")
    .select("*, contact:contacts(*)")
    .eq("workspace_id", workspaceId)
    .order("received_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching inbound emails:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ emails: (data || []) as InboundEmail[] });
}
