/**
 * Server-only Telegram Bot API helper. Token stays in env, never in the client.
 */

import { createHmac } from "crypto";

const TELEGRAM_API = "https://api.telegram.org";

function botToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

export const TELEGRAM_PIPELINE_TEST_TEXT =
  "🔔 *Lunenix Notification Test*: Telegram push pipeline operational!";

function escapeTelegramMarkdown(value: string): string {
  return value.replace(/([_*`\[])/g, "\\$&");
}

export function formatTaskReminderMessage(input: {
  workspaceName: string | null;
  title: string;
  reminderMinutesBefore: number;
}): string {
  const workspaceLabel = input.workspaceName
    ? `[${escapeTelegramMarkdown(input.workspaceName.slice(0, 80))}]`
    : "[Workspace]";
  const title = escapeTelegramMarkdown(input.title.slice(0, 200));
  const minutes = Math.max(1, Math.floor(input.reminderMinutesBefore));
  return `🚨 *Lunenix Reminder* ${workspaceLabel}\n\n*Task:* ${title}\n*Due in:* ${minutes} minutes`;
}

export async function sendTelegramAlert(
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { ok: false, error: "Telegram is not configured." };
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4000),
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    return { ok: false, error: "Telegram rejected the message." };
  }
  return { ok: true };
}

export function telegramBotConfigured(): boolean {
  return Boolean(botToken());
}

export function telegramBotUsername(): string | null {
  const raw = process.env.TELEGRAM_BOT_USERNAME?.trim() ?? "";
  if (!raw) return null;
  return raw.replace(/^@/, "");
}

/**
 * Header Telegram sends as X-Telegram-Bot-Api-Secret-Token.
 * Uses TELEGRAM_WEBHOOK_SECRET when set; otherwise a hash of the bot token
 * so inbound works with only TELEGRAM_BOT_TOKEN on Vercel.
 */
export function telegramWebhookSecret(): string | null {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (explicit && /^[A-Za-z0-9_-]{1,256}$/.test(explicit)) return explicit;
  const token = botToken();
  if (!token) return null;
  return createHmac("sha256", "lunenix-telegram-webhook")
    .update(token)
    .digest("hex");
}

type TelegramApiResult<T> = { ok: true; result: T } | { ok: false };

async function telegramMethod<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramApiResult<T>> {
  const token = botToken();
  if (!token) return { ok: false };
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
  };
  if (!res.ok || !json.ok || json.result === undefined) return { ok: false };
  return { ok: true, result: json.result };
}

export async function fetchTelegramBotUsername(): Promise<string | null> {
  const fromEnv = telegramBotUsername();
  if (fromEnv) return fromEnv;
  const me = await telegramMethod<{ username?: string }>("getMe");
  if (!me.ok || typeof me.result.username !== "string") return null;
  return me.result.username.replace(/^@/, "");
}

export async function ensureTelegramWebhook(
  appBaseUrl: string
): Promise<{ ok: boolean; url: string | null }> {
  const token = botToken();
  const secret = telegramWebhookSecret();
  const base = appBaseUrl.replace(/\/$/, "");
  const url = `${base}/api/telegram/webhook`;
  if (!token || !secret || !base.startsWith("https://")) {
    return { ok: false, url: null };
  }
  const set = await telegramMethod("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
  });
  return { ok: set.ok, url: set.ok ? url : null };
}

/** Customer / workspace chat. Not the staff alert TELEGRAM_CHAT_ID. */
export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<{ ok: true } | { error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { error: "Telegram bot is not configured. Set TELEGRAM_BOT_TOKEN." };
  }
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4000),
    }),
  });
  if (!res.ok) {
    return { error: "Telegram rejected the message." };
  }
  return { ok: true };
}

