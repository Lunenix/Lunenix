import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isMobileBartendingWorkspace(
  industryPreset?: string | null
): boolean {
  return resolveIndustryPreset(industryPreset) === "mobile_bartending";
}

export const BAR_LEAD_SOURCES = [
  "Wedding",
  "Corporate event",
  "Private party",
  "Referral",
  "Venue partnership",
] as const;

export const BAR_EVENT_TYPES = [
  "wedding",
  "corporate",
  "private_party",
  "other",
] as const;
export type BarEventType = (typeof BAR_EVENT_TYPES)[number];
export const BAR_EVENT_TYPE_LABELS: Record<BarEventType, string> = {
  wedding: "Wedding",
  corporate: "Corporate",
  private_party: "Private party",
  other: "Other",
};

export const BAR_PACKAGE_TIERS = [
  "beer_wine",
  "full_open",
  "signature",
  "mocktail",
  "custom",
] as const;
export type BarPackageTier = (typeof BAR_PACKAGE_TIERS)[number];
export const BAR_PACKAGE_TIER_LABELS: Record<BarPackageTier, string> = {
  beer_wine: "Beer / wine",
  full_open: "Full open bar",
  signature: "Signature cocktails",
  mocktail: "Mocktails",
  custom: "Custom",
};

export const BAR_CONSULT_KINDS = ["call", "tasting", "in_person"] as const;
export type BarConsultKind = (typeof BAR_CONSULT_KINDS)[number];
export const BAR_CONSULT_KIND_LABELS: Record<BarConsultKind, string> = {
  call: "Call",
  tasting: "Tasting",
  in_person: "In person",
};

export const BAR_EVENT_STATUSES = [
  "inquiry",
  "booked",
  "completed",
  "cancelled",
] as const;
export type BarEventStatus = (typeof BAR_EVENT_STATUSES)[number];
export const BAR_EVENT_STATUS_LABELS: Record<BarEventStatus, string> = {
  inquiry: "Inquiry",
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const BAR_SETUP_STYLES = ["cart", "tent", "indoor"] as const;
export type BarSetupStyle = (typeof BAR_SETUP_STYLES)[number];
export const BAR_SETUP_STYLE_LABELS: Record<BarSetupStyle, string> = {
  cart: "Mobile bar cart",
  tent: "Tent bar",
  indoor: "Indoor setup",
};

export const BAR_MENU_STATUSES = ["draft", "sent", "approved"] as const;
export type BarMenuStatus = (typeof BAR_MENU_STATUSES)[number];
export const BAR_MENU_STATUS_LABELS: Record<BarMenuStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
};

export const BAR_LOOK_KINDS = ["mockup", "inspiration"] as const;
export type BarLookKind = (typeof BAR_LOOK_KINDS)[number];
export const BAR_LOOK_KIND_LABELS: Record<BarLookKind, string> = {
  mockup: "Mock-up",
  inspiration: "Inspiration",
};

export const BAR_LOOK_STATUSES = ["pending", "approved", "revision"] as const;
export type BarLookStatus = (typeof BAR_LOOK_STATUSES)[number];
export const BAR_LOOK_STATUS_LABELS: Record<BarLookStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  revision: "Revision",
};

export const BAR_COMPLIANCE_KINDS = [
  "liquor_license",
  "catering_permit",
  "liability",
  "venue_requirement",
  "tips_cert",
] as const;
export type BarComplianceKind = (typeof BAR_COMPLIANCE_KINDS)[number];
export const BAR_COMPLIANCE_KIND_LABELS: Record<BarComplianceKind, string> = {
  liquor_license: "Liquor license",
  catering_permit: "Catering / single-event permit",
  liability: "Liability insurance / COI",
  venue_requirement: "Venue requirement",
  tips_cert: "TIPS / responsible service",
};

export const BAR_COMPLIANCE_STATUSES = [
  "needed",
  "valid",
  "expiring",
  "expired",
] as const;
export type BarComplianceStatus = (typeof BAR_COMPLIANCE_STATUSES)[number];
export const BAR_COMPLIANCE_STATUS_LABELS: Record<BarComplianceStatus, string> =
  {
    needed: "Needed",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
  };

export const BAR_ORDER_KINDS = [
  "alcohol",
  "mixer",
  "garnish",
  "glassware",
  "ice",
  "other",
] as const;
export type BarOrderKind = (typeof BAR_ORDER_KINDS)[number];
export const BAR_ORDER_KIND_LABELS: Record<BarOrderKind, string> = {
  alcohol: "Alcohol",
  mixer: "Mixers",
  garnish: "Garnish",
  glassware: "Glassware",
  ice: "Ice",
  other: "Other",
};

export const BAR_ORDER_STATUSES = [
  "needed",
  "ordered",
  "pickup",
  "delivered",
  "returned",
] as const;
export type BarOrderStatus = (typeof BAR_ORDER_STATUSES)[number];
export const BAR_ORDER_STATUS_LABELS: Record<BarOrderStatus, string> = {
  needed: "Needed",
  ordered: "Ordered",
  pickup: "Pickup",
  delivered: "Delivered",
  returned: "Returned / leftover",
};

export const BAR_CREW_ROLES = ["bartender", "barback"] as const;
export type BarCrewRole = (typeof BAR_CREW_ROLES)[number];
export const BAR_CREW_ROLE_LABELS: Record<BarCrewRole, string> = {
  bartender: "Bartender",
  barback: "Barback",
};

export const BAR_ONSITE_KINDS = [
  "setup_photo",
  "consumption",
  "incident",
] as const;
export type BarOnsiteKind = (typeof BAR_ONSITE_KINDS)[number];
export const BAR_ONSITE_KIND_LABELS: Record<BarOnsiteKind, string> = {
  setup_photo: "Setup photo",
  consumption: "Consumption",
  incident: "Incident",
};

export const BAR_INCIDENT_KINDS = ["refusal", "spill", "other"] as const;
export type BarIncidentKind = (typeof BAR_INCIDENT_KINDS)[number];
export const BAR_INCIDENT_KIND_LABELS: Record<BarIncidentKind, string> = {
  refusal: "Over-service refusal",
  spill: "Spill",
  other: "Other",
};

export function isOpenBarOrderStatus(status: string): boolean {
  return ["needed", "ordered", "pickup"].includes(status);
}

export function isBarComplianceAlert(
  status: string,
  expiresOn: string | null
): boolean {
  if (status === "needed" || status === "expired" || status === "expiring") {
    return true;
  }
  if (!expiresOn) return false;
  const d = new Date(expiresOn + "T00:00:00");
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  return d <= soon;
}
