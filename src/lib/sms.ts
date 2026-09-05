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

/** US/NANP E.164. Returns null if the value is not a usable mobile/local number. */
export function normalizeE164(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return normalizeE164(String(Math.trunc(raw)));
  }
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15 && raw.trim().startsWith("+")) {
    return `+${digits}`;
  }
  return null;
}

export function npaFromE164(e164: string): string | null {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
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
