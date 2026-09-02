import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { ACCESS_ENTRY_METHODS } from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("property_access")
    .select(
      "*, contact:contacts(id, first_name, last_name, organization_name, type), project:projects(id, name)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const entry_method = (ACCESS_ENTRY_METHODS as readonly string[]).includes(
    body.entry_method
  )
    ? body.entry_method
    : "occupant";
  const entryCode =
    typeof body.entry_code === "string" ? body.entry_code.trim() || null : null;
  const { data, error } = await auth.supabase
    .from("property_access")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id: body.contact_id || null,
      project_id: body.project_id || null,
      entry_method,
      has_entry_code: Boolean(entryCode) || Boolean(body.has_entry_code),
      entry_code: entryCode,
      pets_notes:
        typeof body.pets_notes === "string"
          ? body.pets_notes.trim() || null
          : null,
      child_safety:
        typeof body.child_safety === "string"
          ? body.child_safety.trim() || null
          : null,
      chemical_sensitive:
        typeof body.chemical_sensitive === "string"
          ? body.chemical_sensitive.trim() || null
          : null,
      special_instructions:
        typeof body.special_instructions === "string"
          ? body.special_instructions.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
}
