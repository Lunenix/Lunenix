import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isCatererWorkspace(industryPreset?: string | null): boolean {
  return resolveIndustryPreset(industryPreset) === "caterer";
}

export const CATERING_LEAD_SOURCES = [
  "Wedding",
  "Corporate event",
  "Private party",
  "Referral",
  "Venue partnership",
] as const;

export const CATERING_EVENT_TYPES = [
  "wedding",
  "corporate",
  "private_party",
  "other",
] as const;
export type CateringEventType = (typeof CATERING_EVENT_TYPES)[number];
export const CATERING_EVENT_TYPE_LABELS: Record<CateringEventType, string> = {
  wedding: "Wedding",
  corporate: "Corporate",
  private_party: "Private party",
  other: "Other",
};

export const CATERING_STYLES = [
  "buffet",
  "plated",
  "family_style",
  "stations",
  "drop_off",
] as const;
export type CateringStyle = (typeof CATERING_STYLES)[number];
export const CATERING_STYLE_LABELS: Record<CateringStyle, string> = {
  buffet: "Buffet",
  plated: "Plated",
  family_style: "Family-style",
  stations: "Stations",
  drop_off: "Drop-off",
};

export const CATERING_EVENT_STATUSES = [
  "inquiry",
  "tasting",
  "booked",
  "completed",
  "cancelled",
] as const;
export type CateringEventStatus = (typeof CATERING_EVENT_STATUSES)[number];
export const CATERING_EVENT_STATUS_LABELS: Record<CateringEventStatus, string> =
  {
    inquiry: "Inquiry",
    tasting: "Tasting",
    booked: "Booked",
    completed: "Completed",
    cancelled: "Cancelled",
  };

export const CATERING_COMPLIANCE_KINDS = [
  "food_handler",
  "health_license",
  "coi",
  "alcohol_permit",
] as const;
export type CateringComplianceKind = (typeof CATERING_COMPLIANCE_KINDS)[number];
export const CATERING_COMPLIANCE_KIND_LABELS: Record<
  CateringComplianceKind,
  string
> = {
  food_handler: "Food handler cert",
  health_license: "Health license / inspection",
  coi: "Liability / COI",
  alcohol_permit: "Alcohol service permit",
};

export const CATERING_COMPLIANCE_STATUSES = [
  "pending",
  "on_file",
  "expired",
] as const;
export type CateringComplianceStatus =
  (typeof CATERING_COMPLIANCE_STATUSES)[number];
export const CATERING_COMPLIANCE_STATUS_LABELS: Record<
  CateringComplianceStatus,
  string
> = {
  pending: "Pending",
  on_file: "On file",
  expired: "Expired",
};

export const CATERING_ORDER_STATUSES = [
  "needed",
  "ordered",
  "delivered",
] as const;
export type CateringOrderStatus = (typeof CATERING_ORDER_STATUSES)[number];
export const CATERING_ORDER_STATUS_LABELS: Record<CateringOrderStatus, string> =
  {
    needed: "Needed",
    ordered: "Ordered",
    delivered: "Delivered",
  };

export const CATERING_PREP_STATUSES = [
  "planned",
  "in_progress",
  "done",
] as const;
export type CateringPrepStatus = (typeof CATERING_PREP_STATUSES)[number];
export const CATERING_PREP_STATUS_LABELS: Record<CateringPrepStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
};

export const CATERING_CREW_ROLES = [
  "chef",
  "server",
  "bartender",
  "captain",
] as const;
export type CateringCrewRole = (typeof CATERING_CREW_ROLES)[number];
export const CATERING_CREW_ROLE_LABELS: Record<CateringCrewRole, string> = {
  chef: "Chef / kitchen",
  server: "Server",
  bartender: "Bartender",
  captain: "Event captain",
};

export const CATERING_EQUIP_KINDS = [
  "kitchen",
  "transport",
  "serving",
  "rental",
] as const;
export type CateringEquipKind = (typeof CATERING_EQUIP_KINDS)[number];
export const CATERING_EQUIP_KIND_LABELS: Record<CateringEquipKind, string> = {
  kitchen: "Kitchen equipment",
  transport: "Transport / holding",
  serving: "Serving ware",
  rental: "Outside rental",
};

export const CATERING_ONSITE_KINDS = [
  "presentation",
  "temp_log",
  "incident",
] as const;
export type CateringOnsiteKind = (typeof CATERING_ONSITE_KINDS)[number];
export const CATERING_ONSITE_KIND_LABELS: Record<CateringOnsiteKind, string> = {
  presentation: "Presentation photo",
  temp_log: "Temperature log",
  incident: "Incident",
};

export function isCateringExpiryAlert(expiresOn: string | null): boolean {
  if (!expiresOn) return true;
  const d = new Date(expiresOn + "T00:00:00");
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  return d <= soon;
}

export function flattenCateringSpecs(
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

export function cateringEventDateFields(body: Record<string, unknown>): {
  event_on: string | null;
  tasting_at: string | null;
  load_in_at: string | null;
  service_start_at: string | null;
  service_end_at: string | null;
  load_out_at: string | null;
} {
  const eventDate = trimStr(body.event_date);
  const eventOnRaw = trimStr(body.event_on) ?? eventDate;
  return {
    event_on: eventOnRaw ? eventOnRaw.slice(0, 10) : null,
    tasting_at: trimStr(body.tasting_at),
    load_in_at: trimStr(body.load_in_at),
    service_start_at: trimStr(body.service_start_at),
    service_end_at: trimStr(body.service_end_at),
    load_out_at: trimStr(body.load_out_at),
  };
}
