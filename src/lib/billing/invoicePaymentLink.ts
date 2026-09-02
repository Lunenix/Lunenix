import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryClient = { from: (relation: string) => any };

const BLOCKED = new Set(["paid", "cancelled"]);

function amountCents(total: number): number {
  return Math.round(total * 100);
}

export type InvoicePaymentLinkRow = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  currency?: string | null;
  stripe_payment_url?: string | null;
  stripe_payment_link_id?: string | null;
};

export async function createOrReuseInvoicePaymentLink(
  supabase: QueryClient,
  workspaceId: string,
  invoice: InvoicePaymentLinkRow
): Promise<{ url: string; reused: boolean } | { error: string }> {
  if (BLOCKED.has(invoice.status)) {
    return {
      error: `Invoice ${invoice.invoice_number} is ${invoice.status}, so a payment link cannot be created.`,
    };
  }
  const total = Number(invoice.total);
  if (!Number.isFinite(total) || total <= 0) {
    return { error: "That invoice has no amount to collect." };
  }
  if (invoice.stripe_payment_url) {
    return { url: invoice.stripe_payment_url, reused: true };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      error:
        "Card payments are not configured yet. Set STRIPE_SECRET_KEY to create payment links.",
    };
  }

  const currency = (invoice.currency || "usd").toLowerCase();
  const product = await stripe.products.create({
    name: `Invoice ${invoice.invoice_number}`,
    metadata: {
      kind: "invoice_payment",
      invoice_id: invoice.id,
      workspace_id: workspaceId,
    },
  });
  const price = await stripe.prices.create({
    currency,
    unit_amount: amountCents(total),
    product: product.id,
  });
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      kind: "invoice_payment",
      invoice_id: invoice.id,
      workspace_id: workspaceId,
    },
  });
  if (!link.url) {
    return { error: "Stripe did not return a payment URL." };
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      stripe_payment_link_id: link.id,
      stripe_payment_url: link.url,
    })
    .eq("id", invoice.id)
    .eq("workspace_id", workspaceId);
  if (error) {
    return { error: error.message };
  }

  return { url: link.url, reused: false };
}

export async function markInvoicePaidFromCheckout(
  supabase: QueryClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.metadata?.kind !== "invoice_payment") return;
  if (session.payment_status !== "paid") return;
  const invoiceId = session.metadata.invoice_id;
  const workspaceId = session.metadata.workspace_id;
  if (!invoiceId || !workspaceId) return;

  await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .neq("status", "cancelled");
}
