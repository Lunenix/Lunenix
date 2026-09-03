import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/contacts?workspaceId=...
 * Lists contacts for the given workspace.
 * Default: active only. Pass archived=1 for archived contacts.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { supabase, workspaceId } = auth;
  const { searchParams } = new URL(request.url);
  const archived = searchParams.get("archived") === "1";

  let query = supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  query = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  const { data: contacts, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: contacts ?? [] });
}

/**
 * POST /api/contacts
 * Creates a contact in the given workspace.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  const payload = {
    workspace_id: auth.workspaceId,
    type: body.type ?? "person",
    first_name: body.first_name ?? null,
    last_name: body.last_name ?? null,
    organization_name: body.organization_name ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    address: body.address ?? null,
    notes: body.notes ?? null,
    tags: Array.isArray(body.tags) ? body.tags : [],
  };

  const { data, error } = await auth.supabase
    .from("contacts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data) {
    executeWorkflowsForTrigger(
      "contact_created",
      {
        contact_id: data.id,
        contact: data,
        user_id: auth.user.id,
      },
      auth.workspaceId
    ).catch((err) => {
      console.error("Error executing contact_created workflows:", err);
    });
  }

  return NextResponse.json({ contact: data }, { status: 201 });
}
