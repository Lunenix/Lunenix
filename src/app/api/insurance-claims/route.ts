import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { CLAIM_PRICING_MODES, CLAIM_STATUSES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId");
  let q = auth.supabase
    .from("insurance_claims")
    .select("*, project:projects(id, name), contact:contacts(*)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claims: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const status = (CLAIM_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "filed";
  const pricing_mode = (CLAIM_PRICING_MODES as readonly string[]).includes(
    body.pricing_mode
  )
    ? body.pricing_mode
    : "insurance";
  const { data, error } = await auth.supabase
    .from("insurance_claims")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      estimate_id: body.estimate_id || null,
      lead_id: body.lead_id || null,
      insurance_company:
        typeof body.insurance_company === "string"
          ? body.insurance_company.trim() || null
          : null,
      policy_number:
        typeof body.policy_number === "string"
          ? body.policy_number.trim() || null
          : null,
      claim_number:
        typeof body.claim_number === "string"
          ? body.claim_number.trim() || null
          : null,
      status,
      pricing_mode,
      adjuster_name:
        typeof body.adjuster_name === "string"
          ? body.adjuster_name.trim() || null
          : null,
      adjuster_phone:
        typeof body.adjuster_phone === "string"
          ? body.adjuster_phone.trim() || null
          : null,
      adjuster_email:
        typeof body.adjuster_email === "string"
          ? body.adjuster_email.trim() || null
          : null,
      adjuster_at: body.adjuster_at || null,
      scope_notes:
        typeof body.scope_notes === "string"
          ? body.scope_notes.trim() || null
          : null,
      supplement_notes:
        typeof body.supplement_notes === "string"
          ? body.supplement_notes.trim() || null
          : null,
      acv_amount:
        body.acv_amount === "" || body.acv_amount == null
          ? null
          : Number(body.acv_amount),
      depreciation_amount:
        body.depreciation_amount === "" || body.depreciation_amount == null
          ? null
          : Number(body.depreciation_amount),
      acv_paid_on: body.acv_paid_on || null,
      depreciation_paid_on: body.depreciation_paid_on || null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claim: data }, { status: 201 });
}
