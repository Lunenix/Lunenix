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

export function isRentalWorkspace(industryPreset?: string | null): boolean {
  return industryPreset === "rental_company";
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
  "paint",
  "primer",
  "drywall",
  "compound",
  "chemical",
  "bait",
  "trap",
  "other",
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  shingles: "Shingles",
  underlayment: "Underlayment",
  dumpster: "Dumpster / roll-off",
  paint: "Paint",
  primer: "Primer",
  drywall: "Drywall sheets",
  compound: "Joint compound / tape",
  chemical: "Chemical / product",
  bait: "Bait",
  trap: "Trap / station",
  other: "Other",
};

export const ESTIMATE_PHOTO_KINDS = [
  "photo",
  "drone",
  "measurement",
  "video",
  "surface",
  "swatch",
  "prep",
  "infestation",
  "entry_point",
  "finding",
  "thermal",
  "moisture",
] as const;
export type EstimatePhotoKind = (typeof ESTIMATE_PHOTO_KINDS)[number];
export const ESTIMATE_PHOTO_KIND_LABELS: Record<EstimatePhotoKind, string> = {
  photo: "Photo",
  drone: "Drone",
  measurement: "Measurement",
  video: "Video",
  surface: "Surface / color",
  swatch: "Swatch",
  prep: "Prep / drywall",
  infestation: "Infestation",
  entry_point: "Entry point",
  finding: "Finding",
  thermal: "Thermal",
  moisture: "Moisture",
};

export const ROOFING_LEAD_SOURCES = [
  "Storm / insurance",
  "Out of pocket",
  "Referral",
] as const;

export const PAINTING_LEAD_SOURCES = [
  "Interior repaint",
  "Exterior",
  "New construction",
  "Drywall",
  "Referral",
] as const;

export const PEST_LEAD_SOURCES = [
  "One-time treatment",
  "Recurring plan",
  "Termite",
  "Mosquito",
  "Rodent",
  "Referral",
] as const;

export const INSPECTION_LEAD_SOURCES = [
  "Buyer",
  "Seller / pre-listing",
  "Realtor referral",
  "Investor",
] as const;

export const RENTAL_LEAD_SOURCES = [
  "Walk-in",
  "Phone",
  "Online booking",
  "Contractor account",
] as const;

export const FIELD_LEAD_SOURCE_SUGGESTIONS = Array.from(
  new Set([
    ...ROOFING_LEAD_SOURCES,
    ...PAINTING_LEAD_SOURCES,
    ...PEST_LEAD_SOURCES,
    ...INSPECTION_LEAD_SOURCES,
    ...RENTAL_LEAD_SOURCES,
  ])
);

export const PAINT_SHEENS = [
  "flat",
  "eggshell",
  "satin",
  "semi_gloss",
  "gloss",
] as const;
export type PaintSheen = (typeof PAINT_SHEENS)[number];
export const PAINT_SHEEN_LABELS: Record<PaintSheen, string> = {
  flat: "Flat",
  eggshell: "Eggshell",
  satin: "Satin",
  semi_gloss: "Semi-gloss",
  gloss: "Gloss",
};

export const HOA_COLOR_STATUSES = [
  "needed",
  "submitted",
  "approved",
  "denied",
  "not_required",
] as const;
export type HoaColorStatus = (typeof HOA_COLOR_STATUSES)[number];
export const HOA_COLOR_STATUS_LABELS: Record<HoaColorStatus, string> = {
  needed: "Needed",
  submitted: "Submitted",
  approved: "Approved",
  denied: "Denied",
  not_required: "Not required",
};
export function isOpenHoaColorStatus(status: string): boolean {
  return ["needed", "submitted", "denied"].includes(status);
}

export const PREP_KINDS = [
  "patching",
  "sanding",
  "caulking",
  "priming",
  "taping",
  "mudding",
  "texture",
  "other",
] as const;
export type PrepKind = (typeof PREP_KINDS)[number];
export const PREP_KIND_LABELS: Record<PrepKind, string> = {
  patching: "Patching",
  sanding: "Sanding",
  caulking: "Caulking",
  priming: "Priming",
  taping: "Taping",
  mudding: "Mudding",
  texture: "Texture match",
  other: "Other",
};

export const PREP_STATUSES = ["todo", "in_progress", "done", "skipped"] as const;
export type PrepStatus = (typeof PREP_STATUSES)[number];
export const PREP_STATUS_LABELS: Record<PrepStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  skipped: "Skipped",
};

export const JOB_WORK_PHASES = [
  "scheduled",
  "prep",
  "priming",
  "painting",
  "completed",
] as const;
export type JobWorkPhase = (typeof JOB_WORK_PHASES)[number];
export const JOB_WORK_PHASE_LABELS: Record<JobWorkPhase, string> = {
  scheduled: "Scheduled",
  prep: "Prep",
  priming: "Priming",
  painting: "Painting",
  completed: "Completed",
};

export const TREATMENT_METHODS = [
  "spray",
  "bait",
  "trap",
  "granular",
  "foam",
  "other",
] as const;
export type TreatmentMethod = (typeof TREATMENT_METHODS)[number];
export const TREATMENT_METHOD_LABELS: Record<TreatmentMethod, string> = {
  spray: "Spray",
  bait: "Bait",
  trap: "Trap",
  granular: "Granular",
  foam: "Foam",
  other: "Other",
};

export const TREATMENT_STATUSES = [
  "logged",
  "guarantee_open",
  "retreatment_due",
  "closed",
] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];
export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  logged: "Logged",
  guarantee_open: "Guarantee open",
  retreatment_due: "Re-treatment due",
  closed: "Closed",
};

export const INSPECTION_PHASES = [
  "scheduled",
  "in_progress",
  "report_pending",
  "delivered",
] as const;
export type InspectionPhase = (typeof INSPECTION_PHASES)[number];
export const INSPECTION_PHASE_LABELS: Record<InspectionPhase, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  report_pending: "Report pending",
  delivered: "Delivered",
};

export const FINDING_SYSTEMS = [
  "roof",
  "hvac",
  "electrical",
  "plumbing",
  "foundation",
  "appliances",
  "interior",
  "exterior",
  "other",
] as const;
export type FindingSystem = (typeof FINDING_SYSTEMS)[number];
export const FINDING_SYSTEM_LABELS: Record<FindingSystem, string> = {
  roof: "Roof",
  hvac: "HVAC",
  electrical: "Electrical",
  plumbing: "Plumbing",
  foundation: "Foundation",
  appliances: "Appliances",
  interior: "Interior",
  exterior: "Exterior",
  other: "Other",
};

export const FINDING_SEVERITIES = [
  "safety",
  "major",
  "minor",
  "cosmetic",
  "info",
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  safety: "Safety",
  major: "Major",
  minor: "Minor",
  cosmetic: "Cosmetic",
  info: "Info",
};

export const FINDING_STATUSES = ["open", "noted", "included_in_report"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open: "Open",
  noted: "Noted",
  included_in_report: "In report",
};

export const REPORT_STATUSES = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "downloaded",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
  viewed: "Viewed",
  downloaded: "Downloaded",
};
export function isPendingInspectionReport(status: string): boolean {
  return ["draft", "ready", "sent"].includes(status);
}

export const ADDON_KINDS = [
  "radon",
  "mold",
  "termite_wdo",
  "sewer",
  "pool",
  "other",
] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];
export const ADDON_KIND_LABELS: Record<AddonKind, string> = {
  radon: "Radon",
  mold: "Mold",
  termite_wdo: "Termite / WDO",
  sewer: "Sewer scope",
  pool: "Pool",
  other: "Other",
};

export const ADDON_STATUSES = [
  "ordered",
  "scheduled",
  "in_progress",
  "complete",
  "cancelled",
] as const;
export type AddonStatus = (typeof ADDON_STATUSES)[number];
export const ADDON_STATUS_LABELS: Record<AddonStatus, string> = {
  ordered: "Ordered",
  scheduled: "Scheduled",
  in_progress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
};
export function isOpenAddonStatus(status: string): boolean {
  return ["ordered", "scheduled", "in_progress"].includes(status);
}

export const ASSET_CATEGORIES = [
  "excavator",
  "loader",
  "lift",
  "generator",
  "trailer",
  "tool",
  "other",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  excavator: "Excavator",
  loader: "Loader",
  lift: "Lift",
  generator: "Generator",
  trailer: "Trailer",
  tool: "Tool",
  other: "Other",
};

export const ASSET_LOCATIONS = ["yard", "out", "in_transit", "in_repair"] as const;
export type AssetLocation = (typeof ASSET_LOCATIONS)[number];
export const ASSET_LOCATION_LABELS: Record<AssetLocation, string> = {
  yard: "Yard",
  out: "Out on rental",
  in_transit: "In transit",
  in_repair: "In repair",
};

export const ASSET_STATUSES = [
  "available",
  "reserved",
  "out",
  "maintenance",
  "retired",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  out: "Out",
  maintenance: "Maintenance",
  retired: "Retired",
};

export const RESERVATION_STATUSES = [
  "hold",
  "reserved",
  "checked_out",
  "returned",
  "cancelled",
  "overdue",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  hold: "Hold",
  reserved: "Reserved",
  checked_out: "Checked out",
  returned: "Returned",
  cancelled: "Cancelled",
  overdue: "Overdue",
};
export function isOpenReservationStatus(status: string): boolean {
  return ["hold", "reserved", "checked_out", "overdue"].includes(status);
}

export const RATE_TYPES = ["hourly", "daily", "weekly"] as const;
export type RateType = (typeof RATE_TYPES)[number];
export const RATE_TYPE_LABELS: Record<RateType, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
};

export const PICKUP_METHODS = ["pickup", "delivery"] as const;
export type PickupMethod = (typeof PICKUP_METHODS)[number];
export const PICKUP_METHOD_LABELS: Record<PickupMethod, string> = {
  pickup: "Customer pickup",
  delivery: "Delivery",
};

export const CONDITION_KINDS = ["checkout", "checkin", "delivery"] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];
export const CONDITION_KIND_LABELS: Record<ConditionKind, string> = {
  checkout: "Check-out",
  checkin: "Check-in",
  delivery: "Delivery",
};

export const MAINT_STATUSES = ["scheduled", "in_repair", "complete"] as const;
export type MaintStatus = (typeof MAINT_STATUSES)[number];
export const MAINT_STATUS_LABELS: Record<MaintStatus, string> = {
  scheduled: "Scheduled",
  in_repair: "In repair",
  complete: "Complete",
};

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T00:00:00`);
  const b = new Date(`${to.slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function lateFeeAmount(
  endsOn: string,
  returnedOn: string,
  dailyRate: number
): number {
  const lateDays = daysBetween(endsOn, returnedOn);
  return Math.round(lateDays * (Number(dailyRate) || 0) * 100) / 100;
}

export const ACCESS_ENTRY_METHODS = [
  "occupant",
  "gate",
  "garage",
  "lockbox",
  "other",
] as const;
export type AccessEntryMethod = (typeof ACCESS_ENTRY_METHODS)[number];
export const ACCESS_ENTRY_METHOD_LABELS: Record<AccessEntryMethod, string> = {
  occupant: "Occupant lets in",
  gate: "Gate",
  garage: "Garage",
  lockbox: "Lockbox",
  other: "Other",
};

export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / 86400000);
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
  "quarterly",
  "seasonal",
] as const;
export type ServicePlanFrequency = (typeof SERVICE_PLAN_FREQUENCIES)[number];
export const SERVICE_PLAN_FREQUENCY_LABELS: Record<ServicePlanFrequency, string> =
  {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
    quarterly: "Quarterly",
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
  else if (frequency === "quarterly") d.setMonth(d.getMonth() + 3);
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
  if (frequency === "quarterly") return Math.round((a / 3) * 100) / 100;
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
