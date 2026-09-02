import {
  industryDisplayLabel,
  industrySectorId,
} from "@/lib/industryVerticals";

/** Default estimate/job type from the workspace vertical — never hardcode HVAC. */
export function defaultEstimateJobType(
  industryPreset?: string | null,
  customLabel?: string | null
): string {
  const label = industryDisplayLabel(industryPreset, customLabel);
  return label === "—" ? "" : label;
}

/** Home & Field Services (HVAC, plumbing, electrical, etc.). */
export function isFieldServiceWorkspace(
  industryPreset?: string | null
): boolean {
  return industrySectorId(industryPreset) === "home_field";
}

export const ESTIMATE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "approved",
  "expired",
  "declined",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  expired: "Expired",
  declined: "Declined",
};

export const EXPENSE_CATEGORIES = [
  "parts",
  "labor",
  "fuel",
  "subcontractor",
  "other",
] as const;

/** Permit lifecycle for Home & Field jobs. */
export const PERMIT_STATUSES = [
  "needed",
  "applied",
  "pulled",
  "approved",
  "inspection_scheduled",
  "passed",
  "failed",
  "not_required",
] as const;

export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  needed: "Needed",
  applied: "Applied",
  pulled: "Pulled",
  approved: "Approved",
  inspection_scheduled: "Inspection scheduled",
  passed: "Inspection passed",
  failed: "Inspection failed",
  not_required: "Not required",
};

export function isOpenPermitStatus(status: string): boolean {
  return ["needed", "applied", "pulled", "inspection_scheduled", "failed"].includes(
    status
  );
}

export const PERMIT_KINDS = ["city", "hoa", "other"] as const;
export type PermitKind = (typeof PERMIT_KINDS)[number];
export const PERMIT_KIND_LABELS: Record<PermitKind, string> = {
  city: "City / county",
  hoa: "HOA",
  other: "Other",
};

export const SERVICE_PLAN_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "seasonal",
] as const;
export type ServicePlanFrequency = (typeof SERVICE_PLAN_FREQUENCIES)[number];
export const SERVICE_PLAN_FREQUENCY_LABELS: Record<ServicePlanFrequency, string> =
  {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
    seasonal: "Seasonal",
  };

export function advanceServiceVisitDate(
  isoDate: string,
  frequency: string
): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** Approximate monthly recurring revenue from a plan amount. */
export function monthlyRecurringAmount(
  frequency: string,
  amount: number
): number {
  const a = Number(amount) || 0;
  if (frequency === "weekly") return Math.round(((a * 52) / 12) * 100) / 100;
  if (frequency === "biweekly") return Math.round(((a * 26) / 12) * 100) / 100;
  return a;
}

/** Suggested tax set-aside from field profit (not a ledger). */
export function suggestedTaxSetAside(profit: number): number {
  return Math.round(Number(profit) * 0.3 * 100) / 100;
}

/** Default reimbursement rate per mile (editable per trip). */
export const DEFAULT_MILEAGE_RATE = 0.7;

export function mileageAmount(miles: number, ratePerMile: number): number {
  const m = Number(miles) || 0;
  const r = Number(ratePerMile) || 0;
  return Math.round(m * r * 100) / 100;
}

export function estimateTotals(
  lineItems: { amount?: number }[],
  taxRate = 0
): { subtotal: number; tax_amount: number; total: number } {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  const tax_amount = (subtotal * (Number(taxRate) || 0)) / 100;
  return { subtotal, tax_amount, total: subtotal + tax_amount };
}
