import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { supabase, workspaceId } = auth;

  const [visits, menus, plans, equipment, invoices] = await Promise.all([
    supabase
      .from("chef_visits")
      .select("id, title, status, grocery_cost, chef_fee")
      .eq("workspace_id", workspaceId),
    supabase
      .from("chef_menus")
      .select("id, title, status, kind")
      .eq("workspace_id", workspaceId),
    supabase
      .from("chef_plans")
      .select("id, title, frequency, paused")
      .eq("workspace_id", workspaceId),
    supabase
      .from("chef_equipment")
      .select("id, title, qty, reorder_below")
      .eq("workspace_id", workspaceId),
    supabase
      .from("invoices")
      .select("id, status, total, invoice_number")
      .eq("workspace_id", workspaceId),
  ]);

  const visitRows = visits.data ?? [];
  const menuRows = menus.data ?? [];
  const planRows = plans.data ?? [];
  const equipRows = equipment.data ?? [];
  const inv = invoices.data ?? [];
  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");
  const complete = visitRows.filter((v: { status: string }) => v.status === "complete");
  const mrrClients = planRows.filter((p: { paused: boolean }) => !p.paused).length;

  return NextResponse.json({
    visits: {
      complete: complete.length,
      open: visitRows.filter(
        (v: { status: string }) =>
          v.status === "scheduled" ||
          v.status === "shopping" ||
          v.status === "cooking"
      ).length,
    },
    recurring: { active_plans: mrrClients },
    money: {
      overdue_invoices: overdue.length,
      open_invoices: sent.length,
    },
    alerts: [
      ...overdue.map((i: { invoice_number?: string }) => ({
        kind: "invoice",
        label: `Overdue invoice ${i.invoice_number ?? ""}`.trim(),
        href: "/invoices",
      })),
      ...menuRows
        .filter((m: { status: string }) => m.status === "pending")
        .map((m: { title: string }) => ({
          kind: "menu",
          label: `Menu needs approval: ${m.title}`,
          href: "/chef-menus",
        })),
      ...visitRows
        .filter((v: { status: string }) => v.status === "skipped")
        .map((v: { title: string }) => ({
          kind: "skip",
          label: `Skipped visit: ${v.title}`,
          href: "/events",
        })),
      ...equipRows
        .filter((e: { qty: number | null; reorder_below: number | null }) => {
          if (e.qty == null || e.reorder_below == null) return false;
          return e.qty <= e.reorder_below;
        })
        .map((e: { title: string }) => ({
          kind: "stock",
          label: `Low stock: ${e.title}`,
          href: "/chef-kit",
        })),
    ],
  });
}
