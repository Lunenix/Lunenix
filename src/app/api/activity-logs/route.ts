import { NextResponse } from "next/server";
import type { ActivityLog } from "@/types/database";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/activity-logs?workspaceId=...
 * Recent tenant-scoped activity for the current workspace.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { supabase, workspaceId } = auth;
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
    : 10;

  const { data: logs, error } = await supabase
    .from("activity_logs")
    .select("id, workspace_id, actor_type, action, description, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: (logs as ActivityLog[]) ?? [] });
}
