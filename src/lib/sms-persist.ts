import "server-only";

import { phonesMatch, SMS_BODY_MAX, toE164 } from "@/lib/sms";
import { sendTwilioSms } from "@/lib/sms-server";
import { contactDisplayName } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (relation: string) => any };

export async function findContactByPhone(
  supabase: Db,
  workspaceId: string,
  phone: string
): Promise<{ id: string; label: string } | null> {
  const { data } = await supabase
    .from("contacts")
    .select("id, type, first_name, last_name, organization_name, email, phone")
    .eq("workspace_id", workspaceId)
    .not("phone", "is", null)
    .limit(500);
  const match = (data ?? []).find((row: { phone: string | null }) =>
    phonesMatch(row.phone, phone)
  );
  if (!match) return null;
  return { id: match.id, label: contactDisplayName(match) };
}

export async function getWorkspaceSmsFrom(
  supabase: Db,
  workspaceId: string
): Promise<{ from: string; enabled: boolean } | { error: string }> {
  const { data, error } = await supabase
    .from("workspace_sms_settings")
    .select("from_e164, enabled")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) return { error: error.message };
  const from = toE164(data?.from_e164 ?? null);
  if (!from) {
    return {
      error:
        "This workspace has no SMS number yet. Add the Twilio From number on Texts.",
    };
  }
  if (data?.enabled === false) {
    return { error: "Texting is turned off for this workspace." };
  }
  return { from, enabled: true };
}

export async function upsertSmsThread(
  supabase: Db,
  opts: {
    workspaceId: string;
    phone: string;
    contactId: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  const phone = toE164(opts.phone);
  if (!phone) return { error: "Need a valid phone number." };
  const { data: existing } = await supabase
    .from("sms_threads")
    .select("id, contact_id")
    .eq("workspace_id", opts.workspaceId)
    .eq("contact_phone", phone)
    .maybeSingle();
  if (existing?.id) {
    const patch: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
    };
    if (!existing.contact_id && opts.contactId) patch.contact_id = opts.contactId;
    await supabase
      .from("sms_threads")
      .update(patch)
      .eq("id", existing.id)
      .eq("workspace_id", opts.workspaceId);
    return { id: existing.id };
  }
  const { data, error } = await supabase
    .from("sms_threads")
    .insert({
      workspace_id: opts.workspaceId,
      contact_id: opts.contactId,
      contact_phone: phone,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    return { error: error?.message ?? "Could not open that conversation." };
  }
  return { id: data.id };
}

export async function recordSmsMessage(
  supabase: Db,
  opts: {
    workspaceId: string;
    threadId: string;
    direction: "inbound" | "outbound";
    body: string;
    providerSid?: string | null;
  }
): Promise<{ error?: string }> {
  const body = opts.body.trim().slice(0, SMS_BODY_MAX);
  if (!body) return { error: "Empty message." };
  const { error } = await supabase.from("sms_messages").insert({
    workspace_id: opts.workspaceId,
    thread_id: opts.threadId,
    direction: opts.direction,
    body,
    provider_sid: opts.providerSid ?? null,
  });
  if (error) return { error: error.message };
  await supabase
    .from("sms_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", opts.threadId)
    .eq("workspace_id", opts.workspaceId);
  return {};
}

export async function sendWorkspaceSms(
  supabase: Db,
  opts: {
    workspaceId: string;
    to: string;
    body: string;
    contactId: string | null;
  }
): Promise<{ summary: string } | { error: string }> {
  const settings = await getWorkspaceSmsFrom(supabase, opts.workspaceId);
  if ("error" in settings) return settings;
  const to = toE164(opts.to);
  if (!to) return { error: "That contact needs a valid phone number." };
  const sent = await sendTwilioSms({
    from: settings.from,
    to,
    body: opts.body,
  });
  if ("error" in sent) return sent;
  const thread = await upsertSmsThread(supabase, {
    workspaceId: opts.workspaceId,
    phone: to,
    contactId: opts.contactId,
  });
  if ("error" in thread) return thread;
  const recorded = await recordSmsMessage(supabase, {
    workspaceId: opts.workspaceId,
    threadId: thread.id,
    direction: "outbound",
    body: opts.body,
    providerSid: sent.sid,
  });
  if (recorded.error) return { error: recorded.error };
  return { summary: "Text sent." };
}
