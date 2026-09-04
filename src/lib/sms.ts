/** Client-safe phone helpers. Twilio credentials stay in server-only modules. */

const E164_RE = /^\+[1-9][0-9]{7,14}$/;

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function toE164(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const compact = raw.trim().replace(/[\s().-]/g, "");
  if (!compact) return null;
  if (E164_RE.test(compact)) return compact;
  const digits = digitsOnly(compact);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function last10Digits(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ea = toE164(a);
  const eb = toE164(b);
  if (ea && eb && ea === eb) return true;
  const da = last10Digits(a);
  const db = last10Digits(b);
  return Boolean(da && db && da === db);
}

export const SMS_BODY_MAX = 1600;
