import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/contracts
 * List all contracts for a workspace, with optional contact/project joins.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  // Fetch contracts with optional contact and project joins
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(
      `
      *,
      contact:contacts(*),
      project:projects(id, name)
    `
    )
    .eq("workspace_id", workspaceId)
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    workspace_id,
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

  if (!workspace_id || !contract_number || !name) {
    return NextResponse.json(
      { error: "workspace_id, contract_number, and name are required" },
      { status: 400 }
    );
  }

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      workspace_id,
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
