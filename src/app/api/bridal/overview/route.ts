import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { isBridalLowStock } from "@/lib/bridalService";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / 86400000);
}

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { supabase, workspaceId } = auth;

  const [items, orders, alts, invoices, bills] = await Promise.all([
    supabase
      .from("bridal_items")
      .select("id, title, tag_code, status, qty, reorder_below, designer, location_label")
      .eq("workspace_id", workspaceId),
    supabase
      .from("bridal_orders")
      .select("id, title, kind, eta_on, status, wedding_on, deposit_paid")
      .eq("workspace_id", workspaceId),
    supabase
      .from("bridal_alterations")
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

  const itemRows = items.data ?? [];
  const orderRows = orders.data ?? [];
  const altRows = alts.data ?? [];
  const inv = invoices.data ?? [];
  const billRows = bills.data ?? [];
  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");

  return NextResponse.json({
    floor: {
      showroom: itemRows.filter((i: { status: string }) => i.status === "showroom")
        .length,
      fitting: itemRows.filter((i: { status: string }) => i.status === "fitting_room")
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
      ...itemRows
        .filter((i: { qty: number; reorder_below: number | null }) =>
          isBridalLowStock(i.qty, i.reorder_below)
        )
        .map((i: { title: string }) => ({
          kind: "stock",
          label: `Low stock: ${i.title}`,
          href: "/gowns",
        })),
      ...orderRows
        .filter((o: { kind: string; eta_on: string | null; status: string }) => {
          if (o.kind !== "special_order" || o.status === "picked_up") return false;
          const d = daysUntil(o.eta_on);
          return d != null && d <= 14;
        })
        .map((o: { title: string }) => ({
          kind: "order",
          label: `Special order arriving soon: ${o.title}`,
          href: "/bridal-orders",
        })),
      ...altRows
        .filter((a: { status: string }) => a.status === "in_alterations")
        .map((a: { title: string }) => ({
          kind: "alterations",
          label: `Alterations in progress: ${a.title}`,
          href: "/alterations",
        })),
      ...orderRows
        .filter((o: { wedding_on: string | null; status: string }) => {
          if (o.status === "picked_up" || o.status === "cancelled") return false;
          const d = daysUntil(o.wedding_on);
          return d != null && d <= 21;
        })
        .map((o: { title: string }) => ({
          kind: "pickup",
          label: `Wedding soon, not picked up: ${o.title}`,
          href: "/bridal-orders",
        })),
      ...orderRows
        .filter(
          (o: { status: string; deposit_paid: boolean }) =>
            o.status !== "cancelled" && o.status !== "picked_up" && !o.deposit_paid
        )
        .map((o: { title: string }) => ({
          kind: "deposit",
          label: `Deposit unpaid: ${o.title}`,
          href: "/bridal-orders",
        })),
    ],
  });
}
