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
