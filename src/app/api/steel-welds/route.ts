import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { NDT_RESULTS, WELD_RESULTS, WELD_TYPES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("steel_weld_logs")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ welds: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const welder_name =
    typeof body.welder_name === "string" ? body.welder_name.trim() : "";
  if (!welder_name) {
    return NextResponse.json({ error: "welder_name is required" }, { status: 400 });
  }
  const weld_type = (WELD_TYPES as readonly string[]).includes(body.weld_type)
    ? body.weld_type
    : "mig";
  const result = (WELD_RESULTS as readonly string[]).includes(body.result)
    ? body.result
    : "pending";
  const ndt_result = (NDT_RESULTS as readonly string[]).includes(body.ndt_result)
    ? body.ndt_result
    : "none";
  const { data, error } = await auth.supabase
    .from("steel_weld_logs")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      welder_name,
      weld_type,
      joint:
        typeof body.joint === "string" ? body.joint.trim() || null : null,
      result,
      ndt_result,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ weld: data }, { status: 201 });
}
