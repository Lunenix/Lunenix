import "server-only";

import { MESSAGE_BODY_MAX, normalizeTelegramChatId } from "@/lib/sms";
import { sendTelegramMessage, telegramBotConfigured } from "@/lib/notify/telegram";
import { contactDisplayName } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (relation: string) => any };

export async function findContactByTelegramChat(
  supabase: Db,
  workspaceId: string,
  chatId: string
): Promise<{ id: string; label: string } | null> {
  const id = normalizeTelegramChatId(chatId);
  if (!id) return null;
  const { data } = await supabase
    .from("contacts")
    .select("id, type, first_name, last_name, organization_name, email")
    .eq("workspace_id", workspaceId)
    .eq("telegram_chat_id", id)
    .maybeSingle();
  if (!data?.id) return null;
  return { id: data.id, label: contactDisplayName(data) };
}

export async function upsertTelegramThread(
  supabase: Db,
  opts: {
    workspaceId: string;
    chatId: string;
    contactId: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  const chatId = normalizeTelegramChatId(opts.chatId);
  if (!chatId) return { error: "Need a valid Telegram chat id." };
  const { data: existing } = await supabase
    .from("sms_threads")
    .select("id, contact_id")
    .eq("workspace_id", opts.workspaceId)
    .eq("telegram_chat_id", chatId)
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
      telegram_chat_id: chatId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    return { error: error?.message ?? "Could not open that conversation." };
  }
  return { id: data.id };
}

export async function recordHubMessage(
  supabase: Db,
  opts: {
    workspaceId: string;
    threadId: string;
    direction: "inbound" | "outbound";
    body: string;
    providerSid?: string | null;
  }
): Promise<{ error?: string }> {
  const body = opts.body.trim().slice(0, MESSAGE_BODY_MAX);
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

export async function sendWorkspaceTelegram(
  supabase: Db,
  opts: {
    workspaceId: string;
    chatId: string;
    body: string;
    contactId: string | null;
  }
): Promise<{ summary: string } | { error: string }> {
  if (!telegramBotConfigured()) {
    return { error: "Telegram bot is not configured. Set TELEGRAM_BOT_TOKEN." };
  }
  const chatId = normalizeTelegramChatId(opts.chatId);
  if (!chatId) return { error: "That contact needs a Telegram chat id." };
  const sent = await sendTelegramMessage(chatId, opts.body);
  if ("error" in sent) return sent;
  const thread = await upsertTelegramThread(supabase, {
    workspaceId: opts.workspaceId,
    chatId,
    contactId: opts.contactId,
  });
  if ("error" in thread) return thread;
  const recorded = await recordHubMessage(supabase, {
    workspaceId: opts.workspaceId,
    threadId: thread.id,
    direction: "outbound",
    body: opts.body,
  });
  if (recorded.error) return { error: recorded.error };
  if (opts.contactId) {
    await supabase
      .from("contacts")
      .update({ telegram_chat_id: chatId })
      .eq("id", opts.contactId)
      .eq("workspace_id", opts.workspaceId)
      .is("telegram_chat_id", null);
  }
  return { summary: "Telegram message sent." };
}
