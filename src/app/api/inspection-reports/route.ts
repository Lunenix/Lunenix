import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { REPORT_STATUSES } from "@/lib/fieldService";

function stampForStatus(status: string): Record<string, string> {
  const now = new Date().toISOString();
  if (status === "ready") return { ready_at: now };
  if (status === "sent") return { sent_at: now };
  if (status === "viewed") return { viewed_at: now };
  if (status === "downloaded") return { downloaded_at: now };
  return {};
}

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("inspection_reports")
    .select(
      "*, project:projects(id, name), contact:contacts(id, first_name, last_name, organization_name, type, email)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const status = (REPORT_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "draft";
  const projectId = body.project_id || null;
  let summary =
    typeof body.summary === "string" ? body.summary.trim() || null : null;
  if (body.build_from_findings && projectId) {
    const { data: findings } = await auth.supabase
      .from("inspection_findings")
      .select("system, title, severity, notes")
      .eq("workspace_id", auth.workspaceId)
      .eq("project_id", projectId);
    const lines = (findings ?? []).map(
      (f: {
        system: string;
        title: string;
        severity: string;
        notes: string | null;
      }) =>
        `${f.severity} · ${f.system}: ${f.title}${f.notes ? ` — ${f.notes}` : ""}`
    );
    if (lines.length) summary = lines.join("\n");
  }
  const { data, error } = await auth.supabase
    .from("inspection_reports")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: projectId,
      contact_id: body.contact_id || null,
      title,
      summary,
      agent_name:
        typeof body.agent_name === "string"
          ? body.agent_name.trim() || null
          : null,
      seller_agent_name:
        typeof body.seller_agent_name === "string"
          ? body.seller_agent_name.trim() || null
          : null,
      property_type:
        typeof body.property_type === "string"
          ? body.property_type.trim() || null
          : null,
      property_size:
        typeof body.property_size === "string"
          ? body.property_size.trim() || null
          : null,
      closing_on: body.closing_on || null,
      due_at: body.due_at || null,
      status,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      ...stampForStatus(status),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data }, { status: 201 });
}
