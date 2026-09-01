import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizePersonalPhone,
  parseSmsEnabled,
} from "@/lib/user-settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/user-settings
 * Caller's own alert-channel prefs. RLS: auth.uid() = user_id.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, personal_phone_number, sms_enabled, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json({ error: "Could not load settings" }, { status: 500 });
  }

  return NextResponse.json({
    settings: data ?? {
      user_id: user.id,
      personal_phone_number: null,
      sms_enabled: true,
      updated_at: null,
    },
  });
}

/**
 * POST /api/user-settings
 * Upsert the authenticated user's phone and SMS toggle.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = normalizePersonalPhone(body.personal_phone_number);
  if (!phone.ok) {
    return NextResponse.json({ error: phone.error }, { status: 400 });
  }

  const smsEnabled = parseSmsEnabled(body.sms_enabled, true);

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        personal_phone_number: phone.value,
        sms_enabled: smsEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("user_id, personal_phone_number, sms_enabled, updated_at")
    .maybeSingle();

  if (error || !data) {
    console.error("Error saving user settings:", error);
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
