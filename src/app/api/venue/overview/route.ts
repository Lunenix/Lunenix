import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { isVenueExpiryAlert } from "@/lib/venueService";

function daysPastDue(due: string | null): number {
  if (!due) return 0;
  const d = new Date(due);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { supabase, workspaceId } = auth;

  const [bookings, compliance, turnovers, deposits, invoices, bills] =
    await Promise.all([
      supabase
        .from("venue_bookings")
        .select(
          "id, title, event_on, status, deposit_paid, date_held, damage_deposit_status"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("venue_compliance")
        .select("id, title, kind, expires_on, status")
        .eq("workspace_id", workspaceId),
      supabase
        .from("venue_turnovers")
        .select("id, title, status")
        .eq("workspace_id", workspaceId),
      supabase
        .from("venue_deposits")
        .select("id, title, status")
        .eq("workspace_id", workspaceId),
      supabase
        .from("invoices")
        .select("id, status, total, due_date, invoice_number")
        .eq("workspace_id", workspaceId),
      supabase
        .from("vendor_bills")
        .select("id, status, amount, due_date")
        .eq("workspace_id", workspaceId),
    ]);

  const bookingRows = bookings.data ?? [];
  const complianceRows = compliance.data ?? [];
  const turnoverRows = turnovers.data ?? [];
  const depositRows = deposits.data ?? [];
  const inv = invoices.data ?? [];
  const billRows = bills.data ?? [];
  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");
  const booked = bookingRows.filter(
    (e: { status: string }) => e.status === "booked" || e.status === "held"
  );
  const horizon = 90;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + horizon);
  const bookedDays = new Set(
    booked
      .map((e: { event_on: string | null }) => e.event_on)
      .filter((d: string | null): d is string => Boolean(d))
      .filter((d: string) => {
        const dt = new Date(d + "T00:00:00");
        return dt >= start && dt < end;
      })
  );

  return NextResponse.json({
    events: {
      upcoming: bookingRows.filter(
        (e: { status: string }) =>
          e.status === "inquiry" || e.status === "held" || e.status === "booked"
      ).length,
      booked: bookingRows.filter((e: { status: string }) => e.status === "booked")
        .length,
    },
    utilization: {
      booked_days: bookedDays.size,
      horizon_days: horizon,
    },
    money: {
      overdue_invoices: overdue.length,
      open_invoices: sent.length,
      bills_pending: billRows.filter(
        (b: { status?: string }) => b.status === "pending" || !b.status
      ).length,
    },
    alerts: [
      ...overdue.map((i: { invoice_number?: string }) => ({
        kind: "invoice",
        label: `Overdue invoice ${i.invoice_number ?? ""}`.trim(),
        href: "/invoices",
      })),
      ...sent
        .filter((i: { due_date?: string | null }) => daysPastDue(i.due_date ?? null) > 0)
        .map((i: { invoice_number?: string }) => ({
          kind: "invoice",
          label: `Past due ${i.invoice_number ?? "invoice"}`,
          href: "/invoices",
        })),
      ...bookingRows
        .filter(
          (e: { status: string; deposit_paid: boolean }) =>
            e.status === "booked" && !e.deposit_paid
        )
        .map((e: { title: string }) => ({
          kind: "deposit",
          label: `Rental deposit unpaid: ${e.title}`,
          href: "/events",
        })),
      ...complianceRows
        .filter(
          (c: { status: string; expires_on: string | null }) =>
            c.status === "pending" ||
            c.status === "expired" ||
            isVenueExpiryAlert(c.expires_on)
        )
        .map((c: { title: string }) => ({
          kind: "insurance",
          label: `Insurance / COI: ${c.title}`,
          href: "/venue-compliance",
        })),
      ...turnoverRows
        .filter((t: { status: string }) => t.status === "tight")
        .map((t: { title: string }) => ({
          kind: "turnover",
          label: `Turnover too tight: ${t.title}`,
          href: "/turnover",
        })),
      ...depositRows
        .filter((d: { status: string }) => d.status === "deducted")
        .map((d: { title: string }) => ({
          kind: "damage",
          label: `Damage deposit deducted: ${d.title}`,
          href: "/damage-deposits",
        })),
    ],
  });
}
