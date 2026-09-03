import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { isPlannerCoiAlert } from "@/lib/plannerService";

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

  const [events, vendors, guests, invoices, bills] = await Promise.all([
    supabase
      .from("planner_events")
      .select("id, title, event_on, status, deposit_paid")
      .eq("workspace_id", workspaceId),
    supabase
      .from("planner_vendors")
      .select("id, name, status, coi_expires_on")
      .eq("workspace_id", workspaceId),
    supabase
      .from("planner_guests")
      .select("id, rsvp")
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

  const eventRows = events.data ?? [];
  const vendorRows = vendors.data ?? [];
  const guestRows = guests.data ?? [];
  const inv = invoices.data ?? [];
  const billRows = bills.data ?? [];
  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");
  const pendingRsvp = guestRows.filter(
    (g: { rsvp: string }) => g.rsvp === "pending"
  ).length;

  return NextResponse.json({
    events: {
      upcoming: eventRows.filter(
        (e: { status: string }) => e.status === "booked" || e.status === "inquiry"
      ).length,
      booked: eventRows.filter((e: { status: string }) => e.status === "booked")
        .length,
    },
    money: {
      overdue_invoices: overdue.length,
      open_invoices: sent.length,
      bills_pending: billRows.filter(
        (b: { status?: string }) => b.status === "pending" || !b.status
      ).length,
    },
    guests: { pending_rsvp: pendingRsvp },
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
      ...eventRows
        .filter(
          (e: { status: string; deposit_paid: boolean }) =>
            e.status === "booked" && !e.deposit_paid
        )
        .map((e: { title: string }) => ({
          kind: "deposit",
          label: `Deposit unpaid: ${e.title}`,
          href: "/events",
        })),
      ...vendorRows
        .filter((v: { status: string }) => v.status === "sourcing" || v.status === "proposed")
        .map((v: { name: string }) => ({
          kind: "vendor",
          label: `Vendor pending: ${v.name}`,
          href: "/event-vendors",
        })),
      ...vendorRows
        .filter((v: { coi_expires_on: string | null }) =>
          isPlannerCoiAlert(v.coi_expires_on)
        )
        .map((v: { name: string }) => ({
          kind: "coi",
          label: `COI expiring: ${v.name}`,
          href: "/event-vendors",
        })),
      ...(pendingRsvp > 0
        ? [
            {
              kind: "rsvp",
              label: `${pendingRsvp} RSVP still pending`,
              href: "/guests",
            },
          ]
        : []),
    ],
  });
}
