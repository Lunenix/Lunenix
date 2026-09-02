import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { SHOP_DESIGN_STATUSES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("shop_designs")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ designs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const status = (SHOP_DESIGN_STATUSES as readonly string[]).includes(
    body.status
  )
    ? body.status
    : "draft";
  const { data, error } = await auth.supabase
    .from("shop_designs")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      contact_id: body.contact_id || null,
      title,
      version: Number(body.version) || 1,
      status,
      dimensions:
        typeof body.dimensions === "string"
          ? body.dimensions.trim() || null
          : null,
      joinery_notes:
        typeof body.joinery_notes === "string"
          ? body.joinery_notes.trim() || null
          : null,
      drawing_url:
        typeof body.drawing_url === "string"
          ? body.drawing_url.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ design: data }, { status: 201 });
}
