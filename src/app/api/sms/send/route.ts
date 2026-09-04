import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { MESSAGE_BODY_MAX, normalizeTelegramChatId } from "@/lib/sms";
import { sendWorkspaceTelegram } from "@/lib/sms-persist";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  const text =
    typeof body.body === "string" ? body.body.trim().slice(0, MESSAGE_BODY_MAX) : "";
  if (!text) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  let chatId = normalizeTelegramChatId(body.telegram_chat_id);
  let contactId: string | null =
    typeof body.contact_id === "string" ? body.contact_id : null;

  if (typeof body.thread_id === "string" && body.thread_id) {
    const { data: thread } = await auth.supabase
      .from("sms_threads")
      .select("id, telegram_chat_id, contact_id")
      .eq("id", body.thread_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    chatId = thread.telegram_chat_id;
    contactId = thread.contact_id ?? contactId;
  }

  if (contactId && !chatId) {
    const { data: contact } = await auth.supabase
      .from("contacts")
      .select("id, telegram_chat_id")
      .eq("id", contactId)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!contact) {
      return NextResponse.json(
        { error: "That contact is not in this workspace." },
        { status: 400 }
      );
    }
    chatId = contact.telegram_chat_id;
  }

  if (!chatId) {
    return NextResponse.json(
      {
        error:
          "Pick a contact that has opened this workspace bot, or an existing thread.",
      },
      { status: 400 }
    );
  }

  const sent = await sendWorkspaceTelegram(auth.supabase, {
    workspaceId: auth.workspaceId,
    chatId,
    body: text,
    contactId,
  });
  if ("error" in sent) {
    return NextResponse.json({ error: sent.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, summary: sent.summary });
}
