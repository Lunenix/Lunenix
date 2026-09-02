import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const contactId = new URL(request.url).searchParams.get("contactId");
  let q = auth.supabase
    .from("customer_equipment")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (contactId) q = q.eq("contact_id", contactId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ equipment: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  if (!body.contact_id || !body.name) {
    return NextResponse.json(
      { error: "contact_id and name are required" },
      { status: 400 }
    );
  }
  const { data, error } = await auth.supabase
    .from("customer_equipment")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id: body.contact_id,
      name: String(body.name).trim(),
      brand: body.brand ?? null,
      model: body.model ?? null,
      serial: body.serial ?? null,
      installed_on: body.installed_on ?? null,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ equipment: data }, { status: 201 });
}
