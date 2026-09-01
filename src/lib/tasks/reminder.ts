/** Lead time for task reminders: 1 minute through 7 days, or none. */

export function parseReminderMinutes(
  raw: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "" || raw === "none") {
    return { ok: true, value: null };
  }
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim()
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Reminder minutes must be a number." };
  }
  const minutes = Math.floor(n);
  if (minutes < 1 || minutes > 10080) {
    return { ok: false, error: "Reminder must be between 1 minute and 7 days." };
  }
  return { ok: true, value: minutes };
}
