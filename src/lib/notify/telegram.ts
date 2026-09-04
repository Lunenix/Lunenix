/**
 * Server-only Telegram Bot API helper. Token stays in env, never in the client.
 */

const TELEGRAM_API = "https://api.telegram.org";

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
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export function telegramBotUsername(): string | null {
  const raw = process.env.TELEGRAM_BOT_USERNAME?.trim() ?? "";
  if (!raw) return null;
  return raw.replace(/^@/, "");
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

