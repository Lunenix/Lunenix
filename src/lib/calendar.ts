export type CalendarKind = "task" | "invoice" | "project" | "booking";

export type CalendarEvent = {
  id: string;
  kind: CalendarKind;
  title: string;
  date: string;
  href: string;
  status: string;
  contactId?: string | null;
};

export function ymdFromUnknown(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function monthBounds(year: number, monthIndex: number): {
  from: string;
  to: string;
} {
  const month = String(monthIndex + 1).padStart(2, "0");
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(last).padStart(2, "0")}`,
  };
}

export function compareCalendarEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.title.localeCompare(b.title);
}
