import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Public inspection report by share token. Service role lookup only — no
 * membership. Does not return workspace ids, emails, or share tokens.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = typeof params.token === "string" ? params.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = createAdminClient();
  const { data: report, error } = await admin
    .from("inspection_reports")
    .select(
      "id, title, summary, agent_name, seller_agent_name, property_type, property_size, closing_on, status, project_id, workspace_id, viewed_at"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (error || !report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (["ready", "sent"].includes(String(report.status))) {
    await admin
      .from("inspection_reports")
      .update({
        status: "viewed",
        viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .eq("workspace_id", report.workspace_id);
  }
  const { data: findings } = report.project_id
    ? await admin
        .from("inspection_findings")
        .select("system, title, severity, notes, moisture_reading, thermal_notes")
        .eq("workspace_id", report.workspace_id)
        .eq("project_id", report.project_id)
        .order("severity")
    : { data: [] };
  const { data: project } = report.project_id
    ? await admin
        .from("projects")
        .select("name, address")
        .eq("id", report.project_id)
        .maybeSingle()
    : { data: null };
  return NextResponse.json({
    report: {
      title: report.title,
      summary: report.summary,
      agent_name: report.agent_name,
      seller_agent_name: report.seller_agent_name,
      property_type: report.property_type,
      property_size: report.property_size,
      closing_on: report.closing_on,
      property: project?.name ?? null,
      address: project?.address ?? null,
    },
    findings: findings ?? [],
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = typeof params.token === "string" ? params.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = createAdminClient();
  const { data: report } = await admin
    .from("inspection_reports")
    .select("id, workspace_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await admin
    .from("inspection_reports")
    .update({
      status: "downloaded",
      downloaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .eq("workspace_id", report.workspace_id);
  return NextResponse.json({ ok: true });
}
