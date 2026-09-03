import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  isBarComplianceAlert,
  isOpenBarOrderStatus,
} from "@/lib/barService";

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

  const [events, compliance, orders, crew, invoices, bills] = await Promise.all([
    supabase
      .from("bar_events")
      .select("id, title, event_on, status, staff_notes, deposit_paid")
      .eq("workspace_id", workspaceId),
    supabase
      .from("bar_compliance")
      .select("id, name, status, expires_on")
      .eq("workspace_id", workspaceId),
    supabase
      .from("bar_supply_orders")
      .select("id, vendor_name, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("bar_crew")
      .select("id, name, tips_expires_on")
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
  const compRows = compliance.data ?? [];
  const orderRows = orders.data ?? [];
  const crewRows = crew.data ?? [];
  const inv = invoices.data ?? [];
  const billRows = bills.data ?? [];

  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");

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
      ...compRows
        .filter((c: { status: string; expires_on: string | null }) =>
          isBarComplianceAlert(c.status, c.expires_on)
        )
        .map((c: { name: string }) => ({
          kind: "compliance",
          label: `License/insurance: ${c.name}`,
          href: "/compliance",
        })),
      ...orderRows
        .filter((o: { status: string }) => isOpenBarOrderStatus(o.status))
        .map((o: { vendor_name: string }) => ({
          kind: "order",
          label: `Supply order open: ${o.vendor_name}`,
          href: "/bar-orders",
        })),
      ...crewRows
        .filter((c: { tips_expires_on: string | null }) =>
          isBarComplianceAlert("valid", c.tips_expires_on)
        )
        .map((c: { name: string }) => ({
          kind: "crew",
          label: `TIPS expiring: ${c.name}`,
          href: "/crew",
        })),
      ...eventRows
        .filter(
          (e: { status: string; staff_notes: string | null }) =>
            e.status === "booked" && !e.staff_notes
        )
        .map((e: { title: string }) => ({
          kind: "staffing",
          label: `Staffing gap: ${e.title}`,
          href: "/events",
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
    ],
  });
}
