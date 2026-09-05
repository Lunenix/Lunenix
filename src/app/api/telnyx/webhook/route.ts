import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeE164 } from "@/lib/sms";
import {
  findContactByPhone,
  recordHubMessage,
  upsertPhoneThread,
} from "@/lib/sms-persist";
import { verifyTelnyxWebhook } from "@/lib/telnyx";

type TelnyxInbound = {
  data?: {
    event_type?: string;
    payload?: {
      id?: string;
      direction?: string;
      text?: string;
      from?: { phone_number?: string };
      to?: Array<{ phone_number?: string }> | { phone_number?: string };
    };
  };
};

function toNumber(payload: TelnyxInbound["data"]): string | null {
  const to = payload?.payload?.to;
  if (Array.isArray(to)) {
    return normalizeE164(to[0]?.phone_number);
  }
  if (to && typeof to === "object") {
    return normalizeE164(to.phone_number);
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const ok = verifyTelnyxWebhook({
    rawBody,
    signatureB64: request.headers.get("telnyx-signature-ed25519"),
    timestamp: request.headers.get("telnyx-timestamp"),
  });
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = JSON.parse(rawBody || "{}") as TelnyxInbound;
  if (update.data?.event_type !== "message.received") {
    return NextResponse.json({ ok: true });
  }
  const payload = update.data.payload;
  const from = normalizeE164(payload?.from?.phone_number);
  const to = toNumber(update.data);
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  const sid = typeof payload?.id === "string" ? payload.id : null;
  if (!from || !to || !text) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("workspace_sms_settings")
    .select("workspace_id")
    .eq("from_e164", to)
    .maybeSingle();
  if (!settings?.workspace_id) {
    return NextResponse.json({ ok: true });
  }
  const workspaceId = String(settings.workspace_id);
  const contact = await findContactByPhone(admin, workspaceId, from);
  const thread = await upsertPhoneThread(admin, {
    workspaceId,
    phone: from,
    contactId: contact?.id ?? null,
  });
  if ("error" in thread) {
    return NextResponse.json({ ok: true });
  }
  await recordHubMessage(admin, {
    workspaceId,
    threadId: thread.id,
    direction: "inbound",
    body: text,
    providerSid: sid,
  });
  return NextResponse.json({ ok: true });
}
