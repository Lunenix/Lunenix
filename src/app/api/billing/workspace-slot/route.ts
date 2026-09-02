import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { getWorkspaceCreateEntitlement } from "@/lib/billing/workspaceSlots";
import {
  EXTRA_WORKSPACE_PRICE_CENTS,
  EXTRA_WORKSPACE_PRICE_USD,
} from "@/lib/workspace";

/**
 * POST /api/billing/workspace-slot
 * Starts Stripe Checkout for one additional owned workspace ($8).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const entitlement = await getWorkspaceCreateEntitlement(admin, user);
  if (entitlement.unlimited || entitlement.canCreate) {
    return NextResponse.json(
      { error: "You already have an unused workspace slot." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "Card payments are not configured yet. Set STRIPE_SECRET_KEY to sell extra workspaces.",
      },
      { status: 503 }
    );
  }

  const origin = request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: {
      user_id: user.id,
      kind: "extra_workspace_slot",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: EXTRA_WORKSPACE_PRICE_CENTS,
          product_data: {
            name: "Additional Lunenix workspace",
            description: `One extra owned workspace ($${EXTRA_WORKSPACE_PRICE_USD})`,
          },
        },
      },
    ],
    success_url: `${origin}/settings/workspaces?workspace_slot=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings/workspaces?workspace_slot=cancel`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
