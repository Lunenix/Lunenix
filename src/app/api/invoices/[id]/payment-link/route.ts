import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { createOrReuseInvoicePaymentLink } from "@/lib/billing/invoicePaymentLink";

/**
 * POST /api/invoices/[id]/payment-link
 * Create or reuse a Stripe Payment Link for this workspace invoice.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authed = await requireWorkspaceRecord("invoices", id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, total, status, currency, stripe_payment_url, stripe_payment_link_id"
    )
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const link = await createOrReuseInvoicePaymentLink(supabase, workspaceId, {
    id: String(data.id),
    invoice_number: String(data.invoice_number),
    total: Number(data.total) || 0,
    status: String(data.status),
    currency: typeof data.currency === "string" ? data.currency : "usd",
    stripe_payment_url:
      typeof data.stripe_payment_url === "string" ? data.stripe_payment_url : null,
    stripe_payment_link_id:
      typeof data.stripe_payment_link_id === "string"
        ? data.stripe_payment_link_id
        : null,
  });

  if ("error" in link) {
    const status = link.error.includes("not configured") ? 503 : 400;
    return NextResponse.json({ error: link.error }, { status });
  }

  return NextResponse.json({
    url: link.url,
    reused: link.reused,
  });
}
