import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { TREATMENT_METHODS, TREATMENT_STATUSES } from "@/lib/fieldService";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId");
  let q = auth.supabase
    .from("pest_treatments")
    .select(
      "*, project:projects(id, name), contact:contacts(id, first_name, last_name, organization_name, type)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("treated_on", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ treatments: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const product =
    typeof body.product_name === "string" ? body.product_name.trim() : "";
  if (!product) {
    return NextResponse.json({ error: "product_name is required" }, { status: 400 });
  }
  const method = (TREATMENT_METHODS as readonly string[]).includes(body.method)
    ? body.method
    : "other";
  const treatedOn =
    typeof body.treated_on === "string" && body.treated_on
      ? body.treated_on.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const guaranteeDays =
    body.guarantee_days === "" || body.guarantee_days == null
      ? null
      : Number(body.guarantee_days);
  const retreatmentUntil =
    guaranteeDays && guaranteeDays > 0 ? addDays(treatedOn, guaranteeDays) : null;
  const status = (TREATMENT_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : retreatmentUntil
      ? "guarantee_open"
      : "logged";
  const { data, error } = await auth.supabase
    .from("pest_treatments")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      product_name: product,
      epa_number:
        typeof body.epa_number === "string"
          ? body.epa_number.trim() || null
          : null,
      method,
      quantity:
        typeof body.quantity === "string" ? body.quantity.trim() || null : null,
      target_pest:
        typeof body.target_pest === "string"
          ? body.target_pest.trim() || null
          : null,
      treatment_area:
        typeof body.treatment_area === "string"
          ? body.treatment_area.trim() || null
          : null,
      treated_on: treatedOn,
      guarantee_days: guaranteeDays,
      retreatment_until: body.retreatment_until || retreatmentUntil,
      status,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ treatment: data }, { status: 201 });
}
