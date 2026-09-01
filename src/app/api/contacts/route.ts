import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/contacts?workspaceId=...
 * Lists contacts for the given workspace.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contacts: data });
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
