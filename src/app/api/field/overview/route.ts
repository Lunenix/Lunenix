import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  monthlyRecurringAmount,
  suggestedTaxSetAside,
  isOpenClaimStatus,
  isOpenMaterialOrderStatus,
  isOpenHoaColorStatus,
  daysUntil,
  isPendingInspectionReport,
  isOpenAddonStatus,
  isOpenReservationStatus,
  isOpenChangeOrderStatus,
  isOpenDrawStatus,
} from "@/lib/fieldService";

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
    plans,
    claims,
    materials,
    finishSpecs,
    hoaRows,
    treatments,
    techs,
    inspReports,
    addons,
    rentalAssets,
    rentalReservations,
    rentalMaint,
    changeOrders,
    constructionSubs,
    constructionPhases,
    constructionDraws,
  ] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, status, total, visit_at, title")
      .eq("workspace_id", workspaceId),
    supabase
      .from("projects")
      .select("id, name, status, urgent, due_date, budget, assignee_id, weather_hold, inspection_phase, closing_on")
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
      .select("id, name, quantity, reorder_at, calibrated_on")
      .eq("workspace_id", workspaceId),
    supabase
      .from("mileage_logs")
      .select("miles, amount")
      .eq("workspace_id", workspaceId),
    supabase
      .from("job_permits")
      .select("id, name, status, permit_number, kind")
      .eq("workspace_id", workspaceId),
    supabase
      .from("service_plans")
      .select("name, frequency, amount, is_active, seasonal_on, next_visit_on, skip_until")
      .eq("workspace_id", workspaceId),
    supabase
      .from("insurance_claims")
      .select("id, status, insurance_company, pricing_mode")
      .eq("workspace_id", workspaceId),
    supabase
      .from("material_orders")
      .select("id, name, status, delivery_on")
      .eq("workspace_id", workspaceId),
    supabase
      .from("job_finish_specs")
      .select("id, room_or_surface, client_signed_off_at, project_id")
      .eq("workspace_id", workspaceId),
    supabase
      .from("hoa_color_approvals")
      .select("id, status, scheme_notes")
      .eq("workspace_id", workspaceId),
    supabase
      .from("pest_treatments")
      .select("id, product_name, status, retreatment_until, target_pest")
      .eq("workspace_id", workspaceId),
    supabase
      .from("technician_profiles")
      .select("id, certifications, license_expires, eo_expires, ce_due_on")
      .eq("workspace_id", workspaceId),
    supabase
      .from("inspection_reports")
      .select("id, title, status, due_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("inspection_addons")
      .select("id, kind, status, specialist_name")
      .eq("workspace_id", workspaceId),
    supabase
      .from("rental_assets")
      .select("id, name, category, status, location, next_service_on")
      .eq("workspace_id", workspaceId),
    supabase
      .from("rental_reservations")
      .select("id, status, ends_on, starts_on, asset_id")
      .eq("workspace_id", workspaceId),
    supabase
      .from("rental_maintenance")
      .select("id, title, status, due_on")
      .eq("workspace_id", workspaceId),
    supabase
      .from("construction_change_orders")
      .select("id, title, status, cost_impact")
      .eq("workspace_id", workspaceId),
    supabase
      .from("construction_subs")
      .select("id, name, coi_expires, license_expires")
      .eq("workspace_id", workspaceId),
    supabase
      .from("construction_phases")
      .select("id, kind, status, delay_cause")
      .eq("workspace_id", workspaceId),
    supabase
      .from("construction_draws")
      .select("id, kind, status, amount, due_on, lien_waiver")
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
  const planRows = plans.data ?? [];
  const claimRows = claims.data ?? [];
  const materialRows = materials.data ?? [];
  const specRows = finishSpecs.data ?? [];
  const hoaApprovals = hoaRows.data ?? [];
  const treatmentRows = treatments.data ?? [];
  const techRows = techs.data ?? [];
  const reportRows = inspReports.data ?? [];
  const addonRows = addons.data ?? [];
  const fleetRows = rentalAssets.data ?? [];
  const rentalRows = rentalReservations.data ?? [];
  const maintRows = rentalMaint.data ?? [];
  const changeRows = changeOrders.data ?? [];
  const subRows = constructionSubs.data ?? [];
  const phaseRows = constructionPhases.data ?? [];
  const drawRows = constructionDraws.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const recurring = planRows
    .filter((p) => p.is_active && (p.frequency !== "seasonal" || p.seasonal_on))
    .reduce(
      (s, p) => s + monthlyRecurringAmount(String(p.frequency), Number(p.amount)),
      0
    );
  const dueVisits = planRows.filter(
    (p) =>
      p.is_active &&
      (p.frequency !== "seasonal" || p.seasonal_on) &&
      p.next_visit_on &&
      String(p.next_visit_on).slice(0, 10) <= today &&
      !(p.skip_until && String(p.skip_until).slice(0, 10) >= today)
  );

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
      tax_set_aside: suggestedTaxSetAside(paid - costs),
      recurring,
      aging,
    },
    fleet: {
      available: fleetRows.filter((a) => a.status === "available").length,
      reserved: fleetRows.filter((a) => a.status === "reserved").length,
      out: fleetRows.filter((a) => a.status === "out").length,
      maintenance: fleetRows.filter((a) => a.status === "maintenance").length,
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
          label: `${p.kind === "hoa" ? "HOA" : "Permit"} not approved: ${p.name}${p.permit_number ? ` (${p.permit_number})` : ""}`,
          href: "/permits",
        })),
      ...dueVisits.map((p) => ({
        kind: "visit_due",
        label: `Recurring visit due: ${p.name}`,
        href: "/plans",
      })),
      ...claimRows
        .filter((c) => isOpenClaimStatus(String(c.status)))
        .map((c) => ({
          kind: "claim_open",
          label: `Claim ${c.status.replace("_", " ")}: ${c.insurance_company || "insurance"}`,
          href: "/claims",
        })),
      ...materialRows
        .filter((m) => isOpenMaterialOrderStatus(String(m.status)))
        .map((m) => ({
          kind: "materials_waiting",
          label: `Materials ${m.status.replace("_", " ")}: ${m.name}`,
          href: "/materials",
        })),
      ...jobs
        .filter((j) => j.weather_hold && !["completed", "cancelled"].includes(String(j.status)))
        .map((j) => ({
          kind: "weather_hold",
          label: `Weather hold: ${j.name}`,
          href: "/jobs",
        })),
      ...hoaApprovals
        .filter((h) => isOpenHoaColorStatus(String(h.status)))
        .map((h) => ({
          kind: "hoa_color",
          label: `HOA color ${h.status}: ${h.scheme_notes || "exterior"}`,
          href: "/colors",
        })),
      ...specRows
        .filter((s) => !s.client_signed_off_at)
        .map((s) => ({
          kind: "color_unsigned",
          label: `Color not signed off: ${s.room_or_surface}`,
          href: "/colors",
        })),
      ...treatmentRows
        .filter((t) => String(t.status) === "retreatment_due")
        .map((t) => ({
          kind: "retreatment",
          label: `Re-treatment: ${t.target_pest || t.product_name}`,
          href: "/treatments",
        })),
      ...techRows
        .filter((t) => {
          const d = daysUntil(t.license_expires);
          return d !== null && d <= 30;
        })
        .map((t) => ({
          kind: "license_renewal",
          label: `License ${
            daysUntil(t.license_expires)! < 0 ? "expired" : "renews soon"
          }${t.certifications ? `: ${t.certifications}` : ""}`,
          href: "/team",
        })),
      ...techRows
        .filter((t) => {
          const d = daysUntil(t.eo_expires);
          return d !== null && d <= 30;
        })
        .map((t) => ({
          kind: "eo_renewal",
          label: `E&O ${daysUntil(t.eo_expires)! < 0 ? "expired" : "renews soon"}`,
          href: "/team",
        })),
      ...techRows
        .filter((t) => {
          const d = daysUntil(t.ce_due_on);
          return d !== null && d <= 30;
        })
        .map((t) => ({
          kind: "ce_due",
          label: `CE ${daysUntil(t.ce_due_on)! < 0 ? "overdue" : "due soon"}`,
          href: "/team",
        })),
      ...reportRows
        .filter((r) => {
          if (!isPendingInspectionReport(String(r.status)) || !r.due_at)
            return false;
          return String(r.due_at).slice(0, 10) < today;
        })
        .map((r) => ({
          kind: "report_overdue",
          label: `Report past due: ${r.title}`,
          href: "/reports",
        })),
      ...addonRows
        .filter((a) => isOpenAddonStatus(String(a.status)))
        .map((a) => ({
          kind: "addon_open",
          label: `Add-on ${a.status.replace("_", " ")}: ${a.kind}${
            a.specialist_name ? ` (${a.specialist_name})` : ""
          }`,
          href: "/addons",
        })),
      ...stock
        .filter((s) => {
          const d = daysUntil(s.calibrated_on);
          return d !== null && d <= -365;
        })
        .map((s) => ({
          kind: "calibration",
          label: `Calibration overdue: ${s.name}`,
          href: "/inventory",
        })),
      ...rentalRows
        .filter(
          (r) =>
            String(r.status) === "checked_out" &&
            r.ends_on &&
            String(r.ends_on).slice(0, 10) < today
        )
        .map(() => ({
          kind: "overdue_return",
          label: "Overdue return",
          href: "/rentals",
        })),
      ...rentalRows
        .filter(
          (r) =>
            String(r.status) === "checked_out" &&
            r.ends_on &&
            String(r.ends_on).slice(0, 10) === today
        )
        .map(() => ({
          kind: "due_back",
          label: "Due back today",
          href: "/rentals",
        })),
      ...rentalRows
        .filter((r) => {
          if (!isOpenReservationStatus(String(r.status)) || !r.ends_on)
            return false;
          const d = daysUntil(r.ends_on);
          return d !== null && d > 0 && d <= 2;
        })
        .map(() => ({
          kind: "return_soon",
          label: "Return reminder window",
          href: "/rentals",
        })),
      ...fleetRows
        .filter((a) => {
          const d = daysUntil(a.next_service_on);
          return d !== null && d <= 0;
        })
        .map((a) => ({
          kind: "service_due",
          label: `Service due: ${a.name}`,
          href: "/maintenance",
        })),
      ...maintRows
        .filter(
          (m) =>
            ["scheduled", "in_repair"].includes(String(m.status)) &&
            m.due_on &&
            String(m.due_on).slice(0, 10) <= today
        )
        .map((m) => ({
          kind: "repair_due",
          label: `Repair due: ${m.title}`,
          href: "/maintenance",
        })),
      ...Array.from(
        new Set(fleetRows.map((a) => String(a.category || "other")))
      )
        .filter((cat) => {
          const group = fleetRows.filter((a) => String(a.category) === cat);
          if (group.length === 0) return false;
          return group.every((a) => a.status !== "available");
        })
        .map((cat) => ({
          kind: "low_availability",
          label: `No units available: ${cat}`,
          href: "/fleet",
        })),
      ...changeRows
        .filter((c) => isOpenChangeOrderStatus(String(c.status)))
        .map((c) => ({
          kind: "change_order",
          label: `Change order ${c.status}: ${c.title}`,
          href: "/change-orders",
        })),
      ...subRows
        .filter((s) => {
          const d = daysUntil(s.coi_expires);
          return d !== null && d <= 30;
        })
        .map((s) => ({
          kind: "coi_expiring",
          label: `Sub COI ${
            daysUntil(s.coi_expires)! < 0 ? "expired" : "expires soon"
          }: ${s.name}`,
          href: "/subs",
        })),
      ...phaseRows
        .filter((p) => String(p.status) === "delayed")
        .map((p) => ({
          kind: "phase_delayed",
          label: `Phase delayed${p.delay_cause ? ` (${p.delay_cause})` : ""}: ${p.kind}`,
          href: "/phases",
        })),
      ...drawRows
        .filter((d) => isOpenDrawStatus(String(d.status)))
        .map((d) => ({
          kind: "draw_open",
          label: `Draw sent: ${d.kind}`,
          href: "/draws",
        })),
      ...drawRows
        .filter(
          (d) =>
            String(d.status) !== "paid" && String(d.lien_waiver) === "needed"
        )
        .map((d) => ({
          kind: "lien_waiver",
          label: `Lien waiver needed: ${d.kind}`,
          href: "/draws",
        })),
    ],
  });
}
