import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { ACCESS_ENTRY_METHODS } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("property_access", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "contact_id",
    "project_id",
    "pets_notes",
    "child_safety",
    "chemical_sensitive",
    "special_instructions",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  if ("entry_code" in body) {
    const code =
      typeof body.entry_code === "string" ? body.entry_code.trim() || null : null;
    update.entry_code = code;
    update.has_entry_code = Boolean(code);
  }
  if ("has_entry_code" in body && !("entry_code" in body)) {
    update.has_entry_code = Boolean(body.has_entry_code);
  }
  if (
    typeof body.entry_method === "string" &&
    (ACCESS_ENTRY_METHODS as readonly string[]).includes(body.entry_method)
  ) {
    update.entry_method = body.entry_method;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("property_access")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("property_access", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("property_access")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
