/**
 * User-owned alert preferences. Phone numbers stay off Luna's context payload.
 */

const PHONE_MAX = 20;

export function normalizePersonalPhone(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Phone number must be text." };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  const compact = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{7,18}$/.test(compact) || compact.length > PHONE_MAX) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  return { ok: true, value: compact };
}

export function parseSmsEnabled(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "on" || raw === 1) return true;
  if (raw === "false" || raw === "off" || raw === 0) return false;
  return fallback;
}
