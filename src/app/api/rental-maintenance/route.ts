import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { MAINT_STATUSES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("rental_maintenance")
    .select("*, asset:rental_assets(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("due_on", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const status = (MAINT_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "scheduled";
  const { data, error } = await auth.supabase
    .from("rental_maintenance")
    .insert({
      workspace_id: auth.workspaceId,
      asset_id: body.asset_id || null,
      title,
      status,
      hours_at_service:
        body.hours_at_service === "" || body.hours_at_service == null
          ? null
          : Number(body.hours_at_service),
      cost:
        body.cost === "" || body.cost == null ? null : Number(body.cost),
      due_on: body.due_on || null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data.asset_id && status === "in_repair") {
    await auth.supabase
      .from("rental_assets")
      .update({
        status: "maintenance",
        location: "in_repair",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.asset_id)
      .eq("workspace_id", auth.workspaceId);
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
