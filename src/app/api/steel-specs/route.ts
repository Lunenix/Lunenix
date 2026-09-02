import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { STEEL_FINISHES, STEEL_METALS } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("steel_specs")
    .select("*, project:projects(id, name)")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ specs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const metal = (STEEL_METALS as readonly string[]).includes(body.metal)
    ? body.metal
    : "mild";
  const finish = (STEEL_FINISHES as readonly string[]).includes(body.finish)
    ? body.finish
    : "raw";
  const { data, error } = await auth.supabase
    .from("steel_specs")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id || null,
      metal,
      finish,
      thickness:
        typeof body.thickness === "string"
          ? body.thickness.trim() || null
          : null,
      name,
      cost: Number(body.cost) || 0,
      quote_valid_until: body.quote_valid_until || null,
      signed_off_at: body.signed_off ? new Date().toISOString() : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spec: data }, { status: 201 });
}
