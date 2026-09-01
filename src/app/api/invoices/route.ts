import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/invoices
 * List all invoices for a workspace, with optional contact/contract/project joins.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { supabase, workspaceId } = auth;
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      contact:contacts(*),
      contract:contracts(id, contract_number, name),
      project:projects(id, name)
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }

  return NextResponse.json({ invoices: invoices ?? [] });
}

/**
 * POST /api/invoices
 * Create a new invoice.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    contact_id,
    contract_id,
    project_id,
    invoice_number,
    status,
    issue_date,
    due_date,
    line_items,
    tax_rate,
    currency,
    notes,
    payment_terms,
  } = body;

  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  if (!contact_id || !invoice_number || !issue_date || !due_date) {
    return NextResponse.json(
      {
        error:
          "contact_id, invoice_number, issue_date, and due_date are required",
      },
      { status: 400 }
    );
  }

  const items = line_items || [];
  const subtotal = items.reduce(
    (sum: number, item: { amount: number }) => sum + (item.amount || 0),
    0
  );
  const taxRate = tax_rate || 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  const { data: invoice, error } = await auth.supabase
    .from("invoices")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id,
      contract_id: contract_id || null,
      project_id: project_id || null,
      invoice_number,
      status: status || "draft",
      issue_date,
      due_date,
      line_items: items,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      currency: currency || "USD",
      notes: notes || null,
      payment_terms: payment_terms || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }

  return NextResponse.json({ invoice }, { status: 201 });
}
