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

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const visible = ((contacts ?? []) as Array<{ archived_at?: string | null }>).filter(
    (row) => {
      const isArchived = Boolean(row.archived_at);
      return archived ? isArchived : !isArchived;
    }
  );

  return NextResponse.json({ contacts: visible });
}

/**
 * POST /api/contacts
 * Creates a contact in the given workspace.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  const payload: Record<string, unknown> = {
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
    archived_at: null,
  };

  let { data, error } = await auth.supabase
    .from("contacts")
    .insert(payload)
    .select("*")
    .single();

  if (error && /archived_at/i.test(error.message)) {
    delete payload.archived_at;
    const retry = await auth.supabase
      .from("contacts")
      .insert(payload)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

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
