import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("construction_daily_logs")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("logged_on", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from("construction_daily_logs")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      logged_on: body.logged_on || new Date().toISOString().slice(0, 10),
      weather:
        typeof body.weather === "string" ? body.weather.trim() || null : null,
      crew_notes:
        typeof body.crew_notes === "string"
          ? body.crew_notes.trim() || null
          : null,
      work_completed:
        typeof body.work_completed === "string"
          ? body.work_completed.trim() || null
          : null,
      issues:
        typeof body.issues === "string" ? body.issues.trim() || null : null,
      safety_notes:
        typeof body.safety_notes === "string"
          ? body.safety_notes.trim() || null
          : null,
      photo_url:
        typeof body.photo_url === "string"
          ? body.photo_url.trim() || null
          : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data }, { status: 201 });
}
