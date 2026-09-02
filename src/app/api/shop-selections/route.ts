import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { SHOP_SELECTION_KINDS } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("shop_selections")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ selections: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const kind = (SHOP_SELECTION_KINDS as readonly string[]).includes(body.kind)
    ? body.kind
    : "species";
  const { data, error } = await auth.supabase
    .from("shop_selections")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      kind,
      name,
      cost: Number(body.cost) || 0,
      photo_url:
        typeof body.photo_url === "string"
          ? body.photo_url.trim() || null
          : null,
      signed_off_at: body.signed_off ? new Date().toISOString() : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ selection: data }, { status: 201 });
}
