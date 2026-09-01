import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendSmsAlert, twilioConfigured } from "@/lib/notify/sms";
import {
  formatTaskReminderMessage,
  formatTaskReminderSms,
  sendTelegramAlert,
} from "@/lib/notify/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  const provided = auth?.replace(/^Bearer\s+/i, "") || key || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type ReminderTask = {
  id: string;
  workspace_id: string;
  title: string;
  due_date: string;
  reminder_minutes_before: number;
  assignee_id: string | null;
  workspaces: { name: string } | { name: string }[] | null;
};

function workspaceName(row: ReminderTask): string | null {
  const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
  return typeof ws?.name === "string" ? ws.name : null;
}

function telegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim()
  );
}

/** Due date is date-only; treat as 09:00 UTC that day. */
function reminderIsDue(
  dueDate: string,
  minutesBefore: number,
  nowMs: number
): boolean {
  const dueAt = Date.parse(`${dueDate.slice(0, 10)}T09:00:00.000Z`);
  if (!Number.isFinite(dueAt)) return false;
  const remindAt = dueAt - minutesBefore * 60 * 1000;
  const staleAfter = dueAt + 24 * 60 * 60 * 1000;
  return nowMs >= remindAt && nowMs < staleAfter;
}

/**
 * GET/POST /api/tasks/reminders/run
 * Telegram and/or SMS for open tasks whose reminder window has opened.
 * Service role + CRON_SECRET. Does not use cookie RLS.
 */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  const canTelegram = telegramConfigured();
  const canSms = twilioConfigured();
  if (!canTelegram && !canSms) {
    return NextResponse.json({ processed: 0, skipped: "alerts_unconfigured" });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select(
      "id, workspace_id, title, due_date, reminder_minutes_before, assignee_id, workspaces(name)"
    )
    .not("reminder_minutes_before", "is", null)
    .is("reminder_sent_at", null)
    .not("due_date", "is", null)
    .neq("status", "done")
    .limit(50);

  if (error) {
    console.error("Task reminder scan failed:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }

  const nowMs = Date.now();
  const due = ((data as ReminderTask[] | null) ?? []).filter((row) =>
    reminderIsDue(row.due_date, row.reminder_minutes_before, nowMs)
  );

  const sentIds: string[] = [];
  let failed = 0;

  for (const todo of due) {
    const messageBody = formatTaskReminderMessage({
      workspaceName: workspaceName(todo),
      title: todo.title,
      reminderMinutesBefore: todo.reminder_minutes_before,
    });
    const smsBody = formatTaskReminderSms({
      workspaceName: workspaceName(todo),
      title: todo.title,
      reminderMinutesBefore: todo.reminder_minutes_before,
    });

    let delivered = false;

    if (canTelegram) {
      const result = await sendTelegramAlert(messageBody);
      if (result.ok) delivered = true;
    }

    if (canSms && todo.assignee_id) {
      const { data: settings } = await admin
        .from("user_settings")
        .select("personal_phone_number, sms_enabled")
        .eq("user_id", todo.assignee_id)
        .maybeSingle();
      const phone =
        typeof settings?.personal_phone_number === "string"
          ? settings.personal_phone_number.trim()
          : "";
      if (settings?.sms_enabled !== false && phone) {
        const sms = await sendSmsAlert(phone, smsBody);
        if (sms.ok) delivered = true;
      }
    }

    if (!delivered) {
      failed++;
      continue;
    }

    const { error: updateError } = await admin
      .from("tasks")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", todo.id)
      .eq("workspace_id", todo.workspace_id)
      .is("reminder_sent_at", null);

    if (updateError) {
      failed++;
      continue;
    }
    sentIds.push(todo.id);
  }

  return NextResponse.json({
    scanned: data?.length ?? 0,
    due: due.length,
    processed: sentIds.length,
    failed,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
