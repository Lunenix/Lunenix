import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";

/**
 * GET /api/contracts/[id]
 * Fetch a single contract with relations.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(
      `
      *,
      contact:contacts(*),
      project:projects(id, name)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract" },
      { status: 500 }
    );
  }

  return NextResponse.json({ contract });
}

/**
 * PATCH /api/contracts/[id]
 * Update a contract.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  
  // Fetch old contract to detect status change
  const { data: oldContract } = await supabase
    .from("contracts")
    .select("status, workspace_id")
    .eq("id", id)
    .single();

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};

  if (body.contact_id !== undefined) updates.contact_id = body.contact_id;
  if (body.project_id !== undefined) updates.project_id = body.project_id;
  if (body.contract_number !== undefined)
    updates.contract_number = body.contract_number;
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.start_date !== undefined) updates.start_date = body.start_date;
  if (body.end_date !== undefined) updates.end_date = body.end_date;
  if (body.signed_at !== undefined) updates.signed_at = body.signed_at;
  if (body.value !== undefined) updates.value = body.value;
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.terms !== undefined) updates.terms = body.terms;

  const { data: contract, error } = await supabase
    .from("contracts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Failed to update contract" },
      { status: 500 }
    );
  }
  
  // Trigger automation workflows if contract was just signed
  if (contract && oldContract && body.status !== undefined && 
      oldContract.status !== "signed" && contract.status === "signed") {
    executeWorkflowsForTrigger("contract_signed", {
      contract_id: contract.id,
      contract,
      contact_id: contract.contact_id,
      project_id: contract.project_id,
      user_id: user.id,
    }, contract.workspace_id).catch((err) => {
      console.error("Error executing contract_signed workflows:", err);
    });
  }

  return NextResponse.json({ contract });
}

/**
 * DELETE /api/contracts/[id]
 * Delete a contract.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase.from("contracts").delete().eq("id", id);

  if (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Failed to delete contract" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
