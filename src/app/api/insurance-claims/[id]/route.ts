import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { CLAIM_PRICING_MODES, CLAIM_STATUSES } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("insurance_claims", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "contact_id",
    "estimate_id",
    "lead_id",
    "insurance_company",
    "policy_number",
    "claim_number",
    "adjuster_name",
    "adjuster_phone",
    "adjuster_email",
    "adjuster_at",
    "scope_notes",
    "supplement_notes",
    "acv_paid_on",
    "depreciation_paid_on",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if (typeof body.status === "string" && (CLAIM_STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status;
  }
  if (
    typeof body.pricing_mode === "string" &&
    (CLAIM_PRICING_MODES as readonly string[]).includes(body.pricing_mode)
  ) {
    update.pricing_mode = body.pricing_mode;
  }
  if ("acv_amount" in body) {
    update.acv_amount =
      body.acv_amount === "" || body.acv_amount == null
        ? null
        : Number(body.acv_amount);
  }
  if ("depreciation_amount" in body) {
    update.depreciation_amount =
      body.depreciation_amount === "" || body.depreciation_amount == null
        ? null
        : Number(body.depreciation_amount);
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("insurance_claims")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claim: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("insurance_claims", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("insurance_claims")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
