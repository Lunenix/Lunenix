import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/contracts
 * List all contracts for a workspace, with optional contact/project joins.
 */
export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  const { data: contracts, error } = await auth.supabase
    .from("contracts")
    .select(
      `
      *,
      contact:contacts(*),
      project:projects(id, name)
    `
    )
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contracts" },
      { status: 500 }
    );
  }

  return NextResponse.json({ contracts: contracts || [] });
}

/**
 * POST /api/contracts
 * Create a new contract.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    contact_id,
    project_id,
    contract_number,
    name,
    description,
    status,
    start_date,
    end_date,
    value,
    currency,
    terms,
  } = body;

  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  if (!contract_number || !name) {
    return NextResponse.json(
      { error: "contract_number and name are required" },
      { status: 400 }
    );
  }

  const { data: contract, error } = await auth.supabase
    .from("contracts")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id: contact_id || null,
      project_id: project_id || null,
      contract_number,
      name,
      description: description || null,
      status: status || "draft",
      start_date: start_date || null,
      end_date: end_date || null,
      value: value || null,
      currency: currency || "USD",
      terms: terms || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating contract:", error);
    return NextResponse.json(
      { error: "Failed to create contract" },
      { status: 500 }
    );
  }

  return NextResponse.json({ contract }, { status: 201 });
}
