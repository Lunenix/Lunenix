/** Client-safe Telegram chat id helpers. Bot token stays server-only. */

export const MESSAGE_BODY_MAX = 1600;

const CHAT_ID_RE = /^-?\d{5,20}$/;

export function normalizeTelegramChatId(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!CHAT_ID_RE.test(trimmed)) return null;
  return trimmed;
}

export function workspaceStartParam(workspaceId: string): string {
  return `w${workspaceId.replace(/-/g, "")}`;
}

export function workspaceIdFromStartParam(param: string): string | null {
  const compact = param.trim().replace(/^w/i, "");
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20, 32),
  ].join("-");
}
