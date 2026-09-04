import { NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("sms_threads", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { data, error } = await supabase
    .from("sms_messages")
    .select("id, direction, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("thread_id", recordId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ messages: data ?? [] });
}
