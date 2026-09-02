import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { grantExtraWorkspaceSlot } from "@/lib/billing/workspaceSlots";

export const runtime = "nodejs";

/**
 * POST /api/billing/stripe/webhook
 * Stripe signs this request. No session cookie.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id ?? session.client_reference_id;
    if (
      userId &&
      session.metadata?.kind === "extra_workspace_slot" &&
      session.payment_status === "paid"
    ) {
      try {
        await grantExtraWorkspaceSlot(createAdminClient(), userId, session.id);
      } catch (e) {
        console.error("grantExtraWorkspaceSlot failed:", e);
        return NextResponse.json({ error: "Grant failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
