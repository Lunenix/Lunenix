import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  FINDING_SYSTEMS,
} from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId");
  let q = auth.supabase
    .from("inspection_findings")
    .select(
      "*, project:projects(id, name), contact:contacts(id, first_name, last_name, organization_name, type, email)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ findings: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const system = (FINDING_SYSTEMS as readonly string[]).includes(body.system)
    ? body.system
    : "other";
  const severity = (FINDING_SEVERITIES as readonly string[]).includes(
    body.severity
  )
    ? body.severity
    : "info";
  const status = (FINDING_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "open";
  const { data, error } = await auth.supabase
    .from("inspection_findings")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      system,
      title,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      severity,
      moisture_reading:
        typeof body.moisture_reading === "string"
          ? body.moisture_reading.trim() || null
          : null,
      thermal_notes:
        typeof body.thermal_notes === "string"
          ? body.thermal_notes.trim() || null
          : null,
      photo_url:
        typeof body.photo_url === "string"
          ? body.photo_url.trim() || null
          : null,
      status,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ finding: data }, { status: 201 });
}
