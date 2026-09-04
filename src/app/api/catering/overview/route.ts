import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { isCateringExpiryAlert } from "@/lib/cateringService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { supabase, workspaceId } = auth;

  const [events, compliance, prep, equipment, invoices, bills] =
    await Promise.all([
      supabase
        .from("catering_events")
        .select(
          "id, title, status, deposit_paid, headcount_confirmed, package_price, food_cost"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("catering_compliance")
        .select("id, title, expires_on, status")
        .eq("workspace_id", workspaceId),
      supabase
        .from("catering_prep")
        .select("id, title, status, assignee_name")
        .eq("workspace_id", workspaceId),
      supabase
        .from("catering_equipment")
        .select("id, title, qty, reorder_below")
        .eq("workspace_id", workspaceId),
      supabase
        .from("invoices")
        .select("id, status, total, invoice_number")
        .eq("workspace_id", workspaceId),
      supabase
        .from("vendor_bills")
        .select("id, status")
        .eq("workspace_id", workspaceId),
    ]);

  const eventRows = events.data ?? [];
  const complianceRows = compliance.data ?? [];
  const prepRows = prep.data ?? [];
  const equipRows = equipment.data ?? [];
  const inv = invoices.data ?? [];
  const billRows = bills.data ?? [];
  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");
  const booked = eventRows.filter((e: { status: string }) => e.status === "booked");
  const withCost = booked.filter(
    (e: { package_price: number | null; food_cost: number | null }) =>
      e.package_price && e.package_price > 0 && e.food_cost != null
  );
  const foodPct =
    withCost.length === 0
      ? null
      : Math.round(
          (withCost.reduce(
            (s: number, e: { food_cost: number; package_price: number }) =>
              s + e.food_cost / e.package_price,
            0
          ) /
            withCost.length) *
            100
        );

  return NextResponse.json({
    events: {
      booked: booked.length,
      upcoming: eventRows.filter(
        (e: { status: string }) =>
          e.status === "inquiry" || e.status === "tasting" || e.status === "booked"
      ).length,
    },
    food_cost_pct: foodPct,
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
      ...eventRows
        .filter(
          (e: { status: string; headcount_confirmed: boolean }) =>
            e.status === "booked" && !e.headcount_confirmed
        )
        .map((e: { title: string }) => ({
          kind: "headcount",
          label: `Final headcount not confirmed: ${e.title}`,
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
      ...complianceRows
        .filter(
          (c: { status: string; expires_on: string | null }) =>
            c.status === "pending" ||
            c.status === "expired" ||
            isCateringExpiryAlert(c.expires_on)
        )
        .map((c: { title: string }) => ({
          kind: "compliance",
          label: `License / COI: ${c.title}`,
          href: "/catering-compliance",
        })),
      ...prepRows
        .filter(
          (p: { status: string; assignee_name: string | null }) =>
            p.status !== "done" && !p.assignee_name
        )
        .map((p: { title: string }) => ({
          kind: "staff",
          label: `Staffing gap: ${p.title}`,
          href: "/kitchen",
        })),
      ...equipRows
        .filter((e: { qty: number | null; reorder_below: number | null }) => {
          if (e.qty == null || e.reorder_below == null) return false;
          return e.qty <= e.reorder_below;
        })
        .map((e: { title: string }) => ({
          kind: "stock",
          label: `Low stock: ${e.title}`,
          href: "/catering-equipment",
        })),
    ],
  });
}
