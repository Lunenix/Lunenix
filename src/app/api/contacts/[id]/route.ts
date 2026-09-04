import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * PATCH /api/contacts/[id]
 * Updates a contact. Membership + workspace_id filter.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("contacts", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const body = await request.json();
  const allowed = [
    "type",
    "first_name",
    "last_name",
    "organization_name",
    "email",
    "phone",
    "telegram_chat_id",
    "address",
    "notes",
    "tags",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (typeof body.archived === "boolean") {
    update.archived_at = body.archived ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(update)
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contact: data });
}

/**
 * DELETE /api/contacts/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("contacts", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
