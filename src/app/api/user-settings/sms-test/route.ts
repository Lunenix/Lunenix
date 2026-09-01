import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendSmsAlert, twilioConfigured } from "@/lib/notify/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/user-settings/sms-test
 * Sends a test SMS to the caller's stored number. Twilio env only.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!twilioConfigured()) {
    return NextResponse.json(
      { error: "SMS is not configured on the server." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("personal_phone_number, sms_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load settings" }, { status: 500 });
  }
  if (!data?.sms_enabled) {
    return NextResponse.json(
      { error: "Enable SMS alerts and save first." },
      { status: 400 }
    );
  }
  const phone =
    typeof data.personal_phone_number === "string"
      ? data.personal_phone_number.trim()
      : "";
  if (!phone) {
    return NextResponse.json(
      { error: "Save a personal phone number first." },
      { status: 400 }
    );
  }

  const sent = await sendSmsAlert(
    phone,
    "Lunenix Notification Test: SMS pipeline operational."
  );
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error ?? "Send failed" },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, sent: true });
}
