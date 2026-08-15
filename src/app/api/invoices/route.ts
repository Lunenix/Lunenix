import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/invoices
 * List all invoices for a workspace, with optional contact/contract/project joins.
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

  // Fetch invoices with optional contact, contract, and project joins
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

  return NextResponse.json({ invoices: invoices || [] });
}

/**
 * POST /api/invoices
 * Create a new invoice.
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

  if (!workspace_id || !contact_id || !invoice_number || !issue_date || !due_date) {
    return NextResponse.json(
      { error: "workspace_id, contact_id, invoice_number, issue_date, and due_date are required" },
      { status: 400 }
    );
  }

  // Calculate totals from line items
  const items = line_items || [];
  const subtotal = items.reduce(
    (sum: number, item: { amount: number }) => sum + (item.amount || 0),
    0
  );
  const taxRate = tax_rate || 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      workspace_id,
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
