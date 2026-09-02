import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { SERVICE_PLAN_FREQUENCIES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("service_plans")
    .select("*, contact:contacts(id, first_name, last_name, organization_name, type, email)")
    .eq("workspace_id", auth.workspaceId)
    .order("next_visit_on", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const contactId =
    typeof body.contact_id === "string" ? body.contact_id : "";
  const nextVisit =
    typeof body.next_visit_on === "string" ? body.next_visit_on.slice(0, 10) : "";
  if (!name || !contactId || !nextVisit) {
    return NextResponse.json(
      { error: "name, contact_id, and next_visit_on are required" },
      { status: 400 }
    );
  }
  const frequency = (SERVICE_PLAN_FREQUENCIES as readonly string[]).includes(
    body.frequency
  )
    ? body.frequency
    : "weekly";
  const { data, error } = await auth.supabase
    .from("service_plans")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id: contactId,
      project_id: body.project_id || null,
      name,
      frequency,
      seasonal_on: body.seasonal_on !== false,
      next_visit_on: nextVisit,
      amount: Number(body.amount) || 0,
      auto_invoice: Boolean(body.auto_invoice),
      is_active: body.is_active !== false,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data }, { status: 201 });
}
