import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { createEditableInvoicePDF } from "@/lib/export/invoicePdf";
import {
  contactDisplayName,
  type Contact,
  type InvoiceLineItem,
} from "@/types/database";

type InvoicePdfRow = {
  invoice_number: string;
  total: number | string | null;
  due_date: string;
  notes: string | null;
  payment_terms: string | null;
  currency: string | null;
  line_items: InvoiceLineItem[] | null;
  contact:
    | Pick<
        Contact,
        "type" | "first_name" | "last_name" | "organization_name" | "email"
      >
    | Pick<
        Contact,
        "type" | "first_name" | "last_name" | "organization_name" | "email"
      >[]
    | null;
};

function safeFilename(invoiceNumber: string): string {
  const base = invoiceNumber.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 40);
  return `${base || "invoice"}.pdf`;
}

/**
 * GET /api/invoices/[id]/pdf?workspaceId=...
 * Membership-checked editable invoice PDF.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const auth = await requireWorkspaceMember(searchParams.get("workspaceId"));
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invoice id is required" }, { status: 400 });
  }

  const { data: invoice, error } = await auth.supabase
    .from("invoices")
    .select(
      `
      invoice_number,
      total,
      due_date,
      notes,
      payment_terms,
      currency,
      line_items,
      workspace_id,
      contact:contacts(type, first_name, last_name, organization_name, email)
    `
    )
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const row = invoice as unknown as InvoicePdfRow;
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
  const clientName = contact ? contactDisplayName(contact) : "Client";

  const fileBuffer = await createEditableInvoicePDF({
    invoice_number: row.invoice_number,
    client_name: clientName,
    total: Number(row.total) || 0,
    due_date: row.due_date,
    notes: row.notes,
    payment_terms: row.payment_terms,
    currency: row.currency || "USD",
    line_items: row.line_items ?? [],
  });

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(row.invoice_number)}"`,
    },
  });
}
