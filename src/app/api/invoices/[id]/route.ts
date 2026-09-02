import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/invoices/[id]
 * Fetch a single invoice with relations.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("invoices", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      contact:contacts(*),
      contract:contracts(id, contract_number, name),
      project:projects(id, name)
    `
    )
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }

  return NextResponse.json({ invoice });
}

/**
 * PATCH /api/invoices/[id]
 * Update an invoice.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("invoices", id);
  if ("error" in authed) return authed.error;
  const { supabase, user, workspaceId, recordId } = authed;
  const body = await req.json();
  
  // Fetch old invoice to detect status change
  const { data: oldInvoice } = await supabase
    .from("invoices")
    .select("status, workspace_id")
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .single();

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};

  if (body.contact_id !== undefined) updates.contact_id = body.contact_id;
  if (body.contract_id !== undefined) updates.contract_id = body.contract_id;
  if (body.project_id !== undefined) updates.project_id = body.project_id;
  if (body.invoice_number !== undefined)
    updates.invoice_number = body.invoice_number;
  if (body.status !== undefined) {
    updates.status = body.status;
    // Auto-set paid_at when marking as paid
    if (body.status === "paid" && !body.paid_at) {
      updates.paid_at = new Date().toISOString();
    }
  }
  if (body.issue_date !== undefined) updates.issue_date = body.issue_date;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.paid_at !== undefined) updates.paid_at = body.paid_at;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.payment_terms !== undefined)
    updates.payment_terms = body.payment_terms;
  if (body.currency !== undefined) updates.currency = body.currency;

  // Recalculate totals if line_items or tax_rate changed
  if (body.line_items !== undefined || body.tax_rate !== undefined) {
    const items = body.line_items || [];
    const subtotal = items.reduce(
      (sum: number, item: { amount: number }) => sum + (item.amount || 0),
      0
    );
    const taxRate = body.tax_rate !== undefined ? body.tax_rate : 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    updates.line_items = items;
    updates.subtotal = subtotal;
    updates.tax_rate = taxRate;
    updates.tax_amount = taxAmount;
    updates.total = total;
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
  
  // Trigger automation workflows if invoice was just sent
  if (invoice && oldInvoice && body.status !== undefined && 
      oldInvoice.status !== "sent" && invoice.status === "sent") {
    executeWorkflowsForTrigger(
      "invoice_sent",
      {
        invoice_id: invoice.id,
        invoice,
        contact_id: invoice.contact_id,
        project_id: invoice.project_id,
        user_id: user.id,
      },
      workspaceId
    ).catch((err) => {
      console.error("Error executing invoice_sent workflows:", err);
    });
  }

  return NextResponse.json({ invoice });
}

/**
 * DELETE /api/invoices/[id]
 * Delete an invoice.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("invoices", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
