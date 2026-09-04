import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { data, error } = await auth.supabase
    .from("sms_threads")
    .select(
      "id, contact_id, telegram_chat_id, last_message_at, created_at, contact:contacts(id, type, first_name, last_name, organization_name, email, phone, telegram_chat_id)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ threads: data ?? [] });
}
