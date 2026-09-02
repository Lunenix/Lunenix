import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { ESTIMATE_STATUSES, estimateTotals, defaultEstimateJobType } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { supabase, workspaceId } = auth;
  const { data, error } = await supabase
    .from("estimates")
    .select("*, contact:contacts(*), photos:estimate_photos(*)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ estimates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  if (!body.contact_id || !body.title) {
    return NextResponse.json(
      { error: "contact_id and title are required" },
      { status: 400 }
    );
  }

  const { data: workspace } = await auth.supabase
    .from("workspaces")
    .select("industry_preset, industry_custom_label")
    .eq("id", auth.workspaceId)
    .maybeSingle();
  const jobTypeFromBody =
    typeof body.job_type === "string" ? body.job_type.trim() : "";
  const job_type =
    jobTypeFromBody ||
    defaultEstimateJobType(
      workspace?.industry_preset,
      workspace?.industry_custom_label
    ) ||
    null;
  const items = Array.isArray(body.line_items) ? body.line_items : [];
  const taxRate = Number(body.tax_rate) || 0;
  const totals = estimateTotals(items, taxRate);

  const { data, error } = await auth.supabase
    .from("estimates")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id: body.contact_id,
      lead_id: body.lead_id ?? null,
      visit_task_id: body.visit_task_id ?? null,
      title: String(body.title).trim(),
      job_type,
      notes: body.notes ?? null,
      address: body.address ?? null,
      visit_at: body.visit_at ?? null,
      status: ESTIMATE_STATUSES.includes(body.status) ? body.status : "draft",
      valid_until: body.valid_until ?? null,
      line_items: items,
      tax_rate: taxRate,
      ...totals,
      currency: body.currency ?? "USD",
    })
    .select("*, contact:contacts(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ estimate: data }, { status: 201 });
}
