import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { toE164 } from "@/lib/sms";
import {
  findContactByPhone,
  recordSmsMessage,
  upsertSmsThread,
} from "@/lib/sms-persist";
import {
  getTwilioConfig,
  isValidTwilioSignature,
  twilioWebhookUrl,
} from "@/lib/sms-server";

const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml() {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Twilio inbound SMS. Matches workspace by the To number on workspace_sms_settings.
 */
export async function POST(request: NextRequest) {
  const cfg = getTwilioConfig();
  if ("error" in cfg) return twiml();

  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  const signature = request.headers.get("x-twilio-signature");
  const url = twilioWebhookUrl(request.url);
  if (
    !isValidTwilioSignature({
      authToken: cfg.authToken,
      signature,
      url,
      params,
    })
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const from = toE164(params.From);
  const to = toE164(params.To);
  const body = (params.Body ?? "").trim();
  const sid = params.MessageSid ?? null;
  if (!from || !to || !body) return twiml();

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("workspace_sms_settings")
    .select("workspace_id, enabled")
    .eq("from_e164", to)
    .maybeSingle();
  if (!settings?.workspace_id || settings.enabled === false) return twiml();

  const contact = await findContactByPhone(admin, settings.workspace_id, from);
  const thread = await upsertSmsThread(admin, {
    workspaceId: settings.workspace_id,
    phone: from,
    contactId: contact?.id ?? null,
  });
  if ("error" in thread) return twiml();
  await recordSmsMessage(admin, {
    workspaceId: settings.workspace_id,
    threadId: thread.id,
    direction: "inbound",
    body,
    providerSid: sid,
  });
  return twiml();
}
