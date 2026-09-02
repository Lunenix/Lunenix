import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { DEFAULT_MILEAGE_RATE, mileageAmount } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId");
  let q = auth.supabase
    .from("mileage_logs")
    .select(
      "*, project:projects(id, name), contact:contacts(id, type, first_name, last_name, organization_name, email)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("driven_on", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const miles = Number(body.miles);
  if (!miles || miles <= 0) {
    return NextResponse.json({ error: "miles must be greater than 0" }, { status: 400 });
  }
  const rate =
    body.rate_per_mile != null
      ? Number(body.rate_per_mile)
      : DEFAULT_MILEAGE_RATE;
  const { data, error } = await auth.supabase
    .from("mileage_logs")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      user_id: auth.user.id,
      driven_on: body.driven_on || new Date().toISOString().slice(0, 10),
      miles,
      rate_per_mile: rate,
      amount: mileageAmount(miles, rate),
      origin: typeof body.origin === "string" ? body.origin.trim() || null : null,
      destination:
        typeof body.destination === "string"
          ? body.destination.trim() || null
          : null,
      purpose:
        typeof body.purpose === "string" ? body.purpose.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data }, { status: 201 });
}
