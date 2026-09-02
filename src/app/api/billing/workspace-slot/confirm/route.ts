import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { grantExtraWorkspaceSlot } from "@/lib/billing/workspaceSlots";

/**
 * POST /api/billing/workspace-slot/confirm
 * Grants a slot after Stripe Checkout when the webhook is delayed.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Card payments are not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const sessionId =
    typeof body.session_id === "string" ? body.session_id.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const payerId = session.metadata?.user_id ?? session.client_reference_id;
  if (payerId !== user.id) {
    return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
  }
  if (session.metadata?.kind !== "extra_workspace_slot") {
    return NextResponse.json({ error: "Wrong checkout type" }, { status: 400 });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not complete" }, { status: 402 });
  }

  const granted = await grantExtraWorkspaceSlot(
    createAdminClient(),
    user.id,
    session.id
  );
  return NextResponse.json({ granted });
}
