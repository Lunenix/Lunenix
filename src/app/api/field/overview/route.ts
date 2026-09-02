import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

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

  const [
    estimates,
    projects,
    invoices,
    expenses,
    bills,
    inventory,
    mileage,
    permits,
  ] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, status, total, visit_at, title")
      .eq("workspace_id", workspaceId),
    supabase
      .from("projects")
      .select("id, name, status, urgent, due_date, budget, assignee_id")
      .eq("workspace_id", workspaceId),
    supabase
      .from("invoices")
      .select("id, status, total, due_date, invoice_number")
      .eq("workspace_id", workspaceId),
    supabase
      .from("job_expenses")
      .select("amount, category")
      .eq("workspace_id", workspaceId),
    supabase
      .from("vendor_bills")
      .select("amount, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("inventory_items")
      .select("id, name, quantity, reorder_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("mileage_logs")
      .select("miles, amount")
      .eq("workspace_id", workspaceId),
    supabase
      .from("job_permits")
      .select("id, name, status, permit_number")
      .eq("workspace_id", workspaceId),
  ]);

  const est = estimates.data ?? [];
  const jobs = projects.data ?? [];
  const inv = invoices.data ?? [];
  const exp = expenses.data ?? [];
  const vb = bills.data ?? [];
  const stock = inventory.data ?? [];
  const miles = mileage.data ?? [];
  const permitRows = permits.data ?? [];

  const paid = inv
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total || 0), 0);
  const openInv = inv.filter((i) =>
    ["sent", "overdue"].includes(String(i.status))
  );
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const i of openInv) {
    const days = daysPastDue(i.due_date);
    const amt = Number(i.total || 0);
    if (days <= 0) aging.current += amt;
    else if (days <= 30) aging.d30 += amt;
    else if (days <= 60) aging.d60 += amt;
    else aging.d90 += amt;
  }
  const expenseTotal = exp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const mileageTotal = miles.reduce((s, m) => s + Number(m.amount || 0), 0);
  const mileageMiles = miles.reduce((s, m) => s + Number(m.miles || 0), 0);
  const costs = expenseTotal + mileageTotal;
  const billsPending = vb
    .filter((b) => b.status === "pending")
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdueInvoices = inv.filter(
    (i) =>
      i.status === "overdue" ||
      (i.status === "sent" && daysPastDue(i.due_date) > 0)
  );
  const longJobs = jobs.filter((j) => {
    if (!["planning", "active"].includes(String(j.status)) || !j.due_date)
      return false;
    return daysPastDue(j.due_date) > 0;
  });
  const lowStock = stock.filter(
    (s) => Number(s.quantity) <= Number(s.reorder_at)
  );

  return NextResponse.json({
    estimates: {
      draft: est.filter((e) => e.status === "draft").length,
      sent: est.filter((e) => e.status === "sent" || e.status === "viewed")
        .length,
      approved: est.filter((e) => e.status === "approved").length,
    },
    jobs: {
      scheduled: jobs.filter((j) => j.status === "planning").length,
      in_progress: jobs.filter((j) => j.status === "active").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      urgent: jobs.filter((j) => j.urgent && j.status !== "completed").length,
      unassigned: jobs.filter(
        (j) => !j.assignee_id && j.status !== "completed" && j.status !== "cancelled"
      ).length,
    },
    money: {
      revenue: paid,
      expenses: costs,
      mileage: mileageTotal,
      miles: mileageMiles,
      bills_pending: billsPending,
      profit: paid - costs,
      aging,
    },
    alerts: [
      ...overdueInvoices.map((i) => ({
        kind: "overdue_invoice",
        label: `Overdue ${i.invoice_number}`,
        href: `/invoices/${i.id}`,
      })),
      ...longJobs.map((j) => ({
        kind: "job_running_long",
        label: `Past due job: ${j.name}`,
        href: `/projects/${j.id}`,
      })),
      ...lowStock.map((s) => ({
        kind: "low_stock",
        label: `Low stock: ${s.name}`,
        href: "/inventory",
      })),
      ...permitRows
        .filter((p) =>
          ["needed", "applied", "pulled", "inspection_scheduled", "failed"].includes(
            String(p.status)
          )
        )
        .map((p) => ({
          kind: "permit_open",
          label: `Permit not approved: ${p.name}${p.permit_number ? ` (${p.permit_number})` : ""}`,
          href: "/permits",
        })),
    ],
  });
}
