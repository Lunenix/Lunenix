import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isEventVenueWorkspace(
  industryPreset?: string | null
): boolean {
  return resolveIndustryPreset(industryPreset) === "event_venue";
}

export const VENUE_EVENT_TYPES = [
  "wedding",
  "corporate",
  "private_party",
  "other",
] as const;
export type VenueEventType = (typeof VENUE_EVENT_TYPES)[number];
export const VENUE_EVENT_TYPE_LABELS: Record<VenueEventType, string> = {
  wedding: "Wedding",
  corporate: "Corporate",
  private_party: "Private party",
  other: "Other",
};

export const VENUE_LEAD_SOURCES = [
  "Wedding",
  "Corporate event",
  "Private party",
  "Referral",
  "Planner partnership",
] as const;

export const VENUE_TIERS = [
  "ceremony_reception",
  "reception_only",
  "hourly_corporate",
] as const;
export type VenueTier = (typeof VENUE_TIERS)[number];
export const VENUE_TIER_LABELS: Record<VenueTier, string> = {
  ceremony_reception: "Ceremony + reception",
  reception_only: "Reception only",
  hourly_corporate: "Hourly corporate",
};

export const VENUE_BOOKING_STATUSES = [
  "inquiry",
  "held",
  "booked",
  "completed",
  "cancelled",
] as const;
export type VenueBookingStatus = (typeof VENUE_BOOKING_STATUSES)[number];
export const VENUE_BOOKING_STATUS_LABELS: Record<VenueBookingStatus, string> = {
  inquiry: "Inquiry",
  held: "Date held",
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const VENUE_DAMAGE_STATUSES = [
  "none",
  "held",
  "refunded",
  "deducted",
] as const;
export type VenueDamageStatus = (typeof VENUE_DAMAGE_STATUSES)[number];
export const VENUE_DAMAGE_STATUS_LABELS: Record<VenueDamageStatus, string> = {
  none: "None",
  held: "Held",
  refunded: "Refunded",
  deducted: "Deducted",
};

export const VENUE_VENDOR_CATEGORIES = [
  "caterer",
  "bar",
  "rentals",
  "dj",
  "florist",
  "other",
] as const;
export type VenueVendorCategory = (typeof VENUE_VENDOR_CATEGORIES)[number];
export const VENUE_VENDOR_CATEGORY_LABELS: Record<
  VenueVendorCategory,
  string
> = {
  caterer: "Caterer",
  bar: "Bar service",
  rentals: "Rentals",
  dj: "DJ / entertainment",
  florist: "Florist",
  other: "Other",
};

export const VENUE_POLICY_KINDS = [
  "alcohol",
  "outside_vendor",
  "coi",
  "other",
] as const;
export type VenuePolicyKind = (typeof VENUE_POLICY_KINDS)[number];
export const VENUE_POLICY_KIND_LABELS: Record<VenuePolicyKind, string> = {
  alcohol: "Alcohol policy",
  outside_vendor: "Outside vendor policy",
  coi: "COI requirement",
  other: "Other",
};

export const VENUE_COMPLIANCE_KINDS = [
  "client_insurance",
  "vendor_coi",
  "liquor_license",
] as const;
export type VenueComplianceKind = (typeof VENUE_COMPLIANCE_KINDS)[number];
export const VENUE_COMPLIANCE_KIND_LABELS: Record<VenueComplianceKind, string> =
  {
    client_insurance: "Client event insurance",
    vendor_coi: "Vendor COI",
    liquor_license: "Venue liquor license",
  };

export const VENUE_COMPLIANCE_STATUSES = [
  "pending",
  "on_file",
  "expired",
] as const;
export type VenueComplianceStatus = (typeof VENUE_COMPLIANCE_STATUSES)[number];
export const VENUE_COMPLIANCE_STATUS_LABELS: Record<
  VenueComplianceStatus,
  string
> = {
  pending: "Pending",
  on_file: "On file",
  expired: "Expired",
};

export const VENUE_LAYOUT_TYPES = [
  "banquet",
  "theater",
  "cocktail",
  "ceremony",
  "corporate",
] as const;
export type VenueLayoutType = (typeof VENUE_LAYOUT_TYPES)[number];
export const VENUE_LAYOUT_TYPE_LABELS: Record<VenueLayoutType, string> = {
  banquet: "Banquet",
  theater: "Theater",
  cocktail: "Cocktail",
  ceremony: "Ceremony",
  corporate: "Corporate",
};

export const VENUE_REVIEW_STATUSES = [
  "pending",
  "approved",
  "revision",
] as const;
export type VenueReviewStatus = (typeof VENUE_REVIEW_STATUSES)[number];
export const VENUE_REVIEW_STATUS_LABELS: Record<VenueReviewStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  revision: "Revision",
};

export const VENUE_CREW_ROLES = [
  "coordinator",
  "setup",
  "security",
  "bartender",
] as const;
export type VenueCrewRole = (typeof VENUE_CREW_ROLES)[number];
export const VENUE_CREW_ROLE_LABELS: Record<VenueCrewRole, string> = {
  coordinator: "Venue coordinator",
  setup: "Setup / breakdown",
  security: "Security",
  bartender: "In-house bartender",
};

export const VENUE_TURNOVER_STATUSES = [
  "scheduled",
  "done",
  "tight",
] as const;
export type VenueTurnoverStatus = (typeof VENUE_TURNOVER_STATUSES)[number];
export const VENUE_TURNOVER_STATUS_LABELS: Record<VenueTurnoverStatus, string> =
  {
    scheduled: "Scheduled",
    done: "Done",
    tight: "Too tight",
  };

export const VENUE_MAINT_KINDS = [
  "equipment",
  "facility",
  "vendor_repair",
] as const;
export type VenueMaintKind = (typeof VENUE_MAINT_KINDS)[number];
export const VENUE_MAINT_KIND_LABELS: Record<VenueMaintKind, string> = {
  equipment: "In-house equipment",
  facility: "Facility",
  vendor_repair: "Vendor repair",
};

export const VENUE_MAINT_STATUSES = [
  "ok",
  "needs_service",
  "scheduled",
] as const;
export type VenueMaintStatus = (typeof VENUE_MAINT_STATUSES)[number];
export const VENUE_MAINT_STATUS_LABELS: Record<VenueMaintStatus, string> = {
  ok: "OK",
  needs_service: "Needs service",
  scheduled: "Service scheduled",
};

export const VENUE_ONSITE_KINDS = [
  "before_photo",
  "after_photo",
  "incident",
  "walkthrough",
] as const;
export type VenueOnsiteKind = (typeof VENUE_ONSITE_KINDS)[number];
export const VENUE_ONSITE_KIND_LABELS: Record<VenueOnsiteKind, string> = {
  before_photo: "Before / setup",
  after_photo: "After / condition",
  incident: "Incident",
  walkthrough: "Client walkthrough",
};

export function isVenueExpiryAlert(expiresOn: string | null): boolean {
  if (!expiresOn) return true;
  const d = new Date(expiresOn + "T00:00:00");
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  return d <= soon;
}

export function flattenVenueSpecs(
  body: Record<string, unknown>
): Record<string, unknown> {
  const specs = body.event_specs;
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    return { ...body, ...(specs as Record<string, unknown>) };
  }
  return body;
}

function trimStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function venueBookingDateFields(body: Record<string, unknown>): {
  event_on: string | null;
  tour_at: string | null;
  load_in_at: string | null;
  event_start_at: string | null;
  event_end_at: string | null;
  load_out_at: string | null;
} {
  const eventDate = trimStr(body.event_date);
  const eventOnRaw = trimStr(body.event_on) ?? eventDate;
  return {
    event_on: eventOnRaw ? eventOnRaw.slice(0, 10) : null,
    tour_at: trimStr(body.tour_at),
    load_in_at: trimStr(body.load_in_at),
    event_start_at: trimStr(body.event_start_at),
    event_end_at: trimStr(body.event_end_at),
    load_out_at: trimStr(body.load_out_at),
  };
}
