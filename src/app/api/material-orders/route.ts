import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  MATERIAL_ORDER_STATUSES,
  MATERIAL_TYPES,
} from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId");
  let q = auth.supabase
    .from("material_orders")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const status = (MATERIAL_ORDER_STATUSES as readonly string[]).includes(
    body.status
  )
    ? body.status
    : "needed";
  const material_type = (MATERIAL_TYPES as readonly string[]).includes(
    body.material_type
  )
    ? body.material_type
    : "shingles";
  const { data, error } = await auth.supabase
    .from("material_orders")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      name,
      material_type,
      color: typeof body.color === "string" ? body.color.trim() || null : null,
      quantity:
        typeof body.quantity === "string" ? body.quantity.trim() || null : null,
      vendor:
        typeof body.vendor === "string" ? body.vendor.trim() || null : null,
      status,
      delivery_on: body.delivery_on || null,
      dropoff_notes:
        typeof body.dropoff_notes === "string"
          ? body.dropoff_notes.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data }, { status: 201 });
}
