import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { PAINT_SHEENS } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId");
  let q = auth.supabase
    .from("job_finish_specs")
    .select(
      "*, project:projects(id, name), contact:contacts(id, first_name, last_name, organization_name, type, email)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ specs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const room =
    typeof body.room_or_surface === "string" ? body.room_or_surface.trim() : "";
  if (!room) {
    return NextResponse.json(
      { error: "room_or_surface is required" },
      { status: 400 }
    );
  }
  const sheen = (PAINT_SHEENS as readonly string[]).includes(body.sheen)
    ? body.sheen
    : null;
  const { data, error } = await auth.supabase
    .from("job_finish_specs")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      room_or_surface: room,
      brand: typeof body.brand === "string" ? body.brand.trim() || null : null,
      color_name:
        typeof body.color_name === "string"
          ? body.color_name.trim() || null
          : null,
      color_code:
        typeof body.color_code === "string"
          ? body.color_code.trim() || null
          : null,
      sheen,
      quantity:
        typeof body.quantity === "string" ? body.quantity.trim() || null : null,
      supplier:
        typeof body.supplier === "string" ? body.supplier.trim() || null : null,
      match_notes:
        typeof body.match_notes === "string"
          ? body.match_notes.trim() || null
          : null,
      client_signed_off_at: body.client_signed_off_at || null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spec: data }, { status: 201 });
}
