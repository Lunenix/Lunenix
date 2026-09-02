import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { SUB_TRADES } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("construction_subs")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const trade = (SUB_TRADES as readonly string[]).includes(body.trade)
    ? body.trade
    : "other";
  const { data, error } = await auth.supabase
    .from("construction_subs")
    .insert({
      workspace_id: auth.workspaceId,
      name,
      trade,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      email: typeof body.email === "string" ? body.email.trim() || null : null,
      coi_expires: body.coi_expires || null,
      license_expires: body.license_expires || null,
      rate_notes:
        typeof body.rate_notes === "string"
          ? body.rate_notes.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sub: data }, { status: 201 });
}
