import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";

/**
 * GET /api/contacts?workspaceId=...
 * Lists contacts for the given workspace (RLS also enforces membership).
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id } = body;
  if (!workspace_id) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  const payload = {
    workspace_id,
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

  const { data, error } = await supabase
    .from("contacts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Trigger automation workflows for contact_created
  if (data) {
    executeWorkflowsForTrigger("contact_created", {
      contact_id: data.id,
      contact: data,
      user_id: user.id,
    }, workspace_id).catch((err) => {
      console.error("Error executing contact_created workflows:", err);
    });
  }
  
  return NextResponse.json({ contact: data }, { status: 201 });
}
