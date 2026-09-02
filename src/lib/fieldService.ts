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

export function isRoofingWorkspace(industryPreset?: string | null): boolean {
  return industryPreset === "roofing_exterior_repair";
}

export const CLAIM_STATUSES = [
  "filed",
  "adjuster_scheduled",
  "approved",
  "denied",
  "supplement_pending",
  "paid",
  "closed",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  filed: "Filed",
  adjuster_scheduled: "Adjuster scheduled",
  approved: "Approved",
  denied: "Denied",
  supplement_pending: "Supplement pending",
  paid: "Paid",
  closed: "Closed",
};
export function isOpenClaimStatus(status: string): boolean {
  return ["filed", "adjuster_scheduled", "denied", "supplement_pending"].includes(
    status
  );
}

export const CLAIM_PRICING_MODES = ["insurance", "out_of_pocket"] as const;
export type ClaimPricingMode = (typeof CLAIM_PRICING_MODES)[number];
export const CLAIM_PRICING_LABELS: Record<ClaimPricingMode, string> = {
  insurance: "Insurance",
  out_of_pocket: "Out of pocket",
};

export const MATERIAL_ORDER_STATUSES = [
  "needed",
  "ordered",
  "in_transit",
  "delivered",
  "delayed",
  "cancelled",
] as const;
export type MaterialOrderStatus = (typeof MATERIAL_ORDER_STATUSES)[number];
export const MATERIAL_ORDER_STATUS_LABELS: Record<MaterialOrderStatus, string> =
  {
    needed: "Needed",
    ordered: "Ordered",
    in_transit: "In transit",
    delivered: "Delivered",
    delayed: "Delayed",
    cancelled: "Cancelled",
  };
export function isOpenMaterialOrderStatus(status: string): boolean {
  return ["needed", "ordered", "in_transit", "delayed"].includes(status);
}

export const MATERIAL_TYPES = [
  "shingles",
  "underlayment",
  "dumpster",
  "other",
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  shingles: "Shingles",
  underlayment: "Underlayment",
  dumpster: "Dumpster / roll-off",
  other: "Other",
};

export const ESTIMATE_PHOTO_KINDS = [
  "photo",
  "drone",
  "measurement",
  "video",
] as const;
export type EstimatePhotoKind = (typeof ESTIMATE_PHOTO_KINDS)[number];
export const ESTIMATE_PHOTO_KIND_LABELS: Record<EstimatePhotoKind, string> = {
  photo: "Photo",
  drone: "Drone",
  measurement: "Measurement",
  video: "Video",
};

export const ROOFING_LEAD_SOURCES = [
  "Storm / insurance",
  "Out of pocket",
  "Referral",
] as const;

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
