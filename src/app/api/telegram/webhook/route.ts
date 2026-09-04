import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  normalizeTelegramChatId,
  workspaceIdFromStartParam,
} from "@/lib/sms";
import {
  findContactByTelegramChat,
  recordHubMessage,
  upsertTelegramThread,
} from "@/lib/sms-persist";
import { telegramBotConfigured, telegramWebhookSecret } from "@/lib/notify/telegram";
import { timingSafeEqual } from "crypto";

function secretOk(header: string | null): boolean {
  const expected = telegramWebhookSecret();
  if (!expected) return false;
  const provided = header ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type TelegramUpdate = {
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string };
  };
};

/**
 * Telegram Bot API webhook. Routes chats into the workspace from /start.
 */
export async function POST(request: NextRequest) {
  if (!telegramBotConfigured()) {
    return NextResponse.json({ ok: true });
  }
  if (!secretOk(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
  const message = update.message;
  const chatId = normalizeTelegramChatId(message?.chat?.id);
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("sms_threads")
    .select("id, workspace_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  let workspaceId: string | null = existing?.workspace_id ?? null;

  const start = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  if (!workspaceId && start?.[1]) {
    workspaceId = workspaceIdFromStartParam(start[1]);
    if (workspaceId) {
      const { data: ws } = await admin
        .from("workspaces")
        .select("id")
        .eq("id", workspaceId)
        .maybeSingle();
      if (!ws?.id) workspaceId = null;
    }
  }

  if (!workspaceId) {
    return NextResponse.json({ ok: true });
  }

  const contact = await findContactByTelegramChat(admin, workspaceId, chatId);
  const thread = await upsertTelegramThread(admin, {
    workspaceId,
    chatId,
    contactId: contact?.id ?? null,
  });
  if ("error" in thread) {
    return NextResponse.json({ ok: true });
  }
  if (!start) {
    await recordHubMessage(admin, {
      workspaceId,
      threadId: thread.id,
      direction: "inbound",
      body: text,
      providerSid:
        typeof message?.message_id === "number" ? String(message.message_id) : null,
    });
  }
  return NextResponse.json({ ok: true });
}
