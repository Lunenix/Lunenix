import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isBridalShopWorkspace(
  industryPreset?: string | null
): boolean {
  return resolveIndustryPreset(industryPreset) === "bridal_shop";
}

export const BRIDAL_LEAD_SOURCES = [
  "Bride",
  "Bridesmaid",
  "Mother of the bride",
  "Referral",
  "Online inquiry",
  "Walk-in",
] as const;

export const BRIDAL_ITEM_KINDS = [
  "gown",
  "veil",
  "jewelry",
  "shoes",
  "undergarment",
  "bridesmaid",
  "other",
] as const;
export type BridalItemKind = (typeof BRIDAL_ITEM_KINDS)[number];
export const BRIDAL_ITEM_KIND_LABELS: Record<BridalItemKind, string> = {
  gown: "Gown",
  veil: "Veil",
  jewelry: "Jewelry",
  shoes: "Shoes",
  undergarment: "Undergarment",
  bridesmaid: "Bridesmaid dress",
  other: "Other",
};

export const BRIDAL_ITEM_STATUSES = [
  "showroom",
  "fitting_room",
  "on_hold",
  "alterations",
  "sold",
  "in_transit",
  "returned",
] as const;
export type BridalItemStatus = (typeof BRIDAL_ITEM_STATUSES)[number];
export const BRIDAL_ITEM_STATUS_LABELS: Record<BridalItemStatus, string> = {
  showroom: "In showroom",
  fitting_room: "In fitting room",
  on_hold: "On hold",
  alterations: "In alterations",
  sold: "Sold",
  in_transit: "In transit",
  returned: "Return to designer",
};

export const BRIDAL_APPT_STATUSES = [
  "booked",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type BridalApptStatus = (typeof BRIDAL_APPT_STATUSES)[number];
export const BRIDAL_APPT_STATUS_LABELS: Record<BridalApptStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export const BRIDAL_ORDER_KINDS = ["in_stock", "special_order"] as const;
export type BridalOrderKind = (typeof BRIDAL_ORDER_KINDS)[number];
export const BRIDAL_ORDER_KIND_LABELS: Record<BridalOrderKind, string> = {
  in_stock: "In-stock purchase",
  special_order: "Special order",
};

export const BRIDAL_ORDER_STATUSES = [
  "deposit",
  "ordered",
  "arrived",
  "picked_up",
  "cancelled",
] as const;
export type BridalOrderStatus = (typeof BRIDAL_ORDER_STATUSES)[number];
export const BRIDAL_ORDER_STATUS_LABELS: Record<BridalOrderStatus, string> = {
  deposit: "Deposit taken",
  ordered: "On order",
  arrived: "Arrived",
  picked_up: "Picked up",
  cancelled: "Cancelled",
};

export const BRIDAL_ALT_STATUSES = [
  "measured",
  "in_alterations",
  "ready_fitting",
  "final_complete",
  "ready_pickup",
] as const;
export type BridalAltStatus = (typeof BRIDAL_ALT_STATUSES)[number];
export const BRIDAL_ALT_STATUS_LABELS: Record<BridalAltStatus, string> = {
  measured: "Measured",
  in_alterations: "In alterations",
  ready_fitting: "Ready for fitting",
  final_complete: "Final fitting complete",
  ready_pickup: "Ready for pickup",
};

export const BRIDAL_CREW_ROLES = ["stylist", "seamstress"] as const;
export type BridalCrewRole = (typeof BRIDAL_CREW_ROLES)[number];
export const BRIDAL_CREW_ROLE_LABELS: Record<BridalCrewRole, string> = {
  stylist: "Stylist",
  seamstress: "Seamstress",
};

export const BRIDAL_RECEIVE_STATUSES = [
  "expected",
  "received",
  "placed",
] as const;
export type BridalReceiveStatus = (typeof BRIDAL_RECEIVE_STATUSES)[number];
export const BRIDAL_RECEIVE_STATUS_LABELS: Record<BridalReceiveStatus, string> =
  {
    expected: "Expected",
    received: "Scanned in",
    placed: "On floor",
  };

export function formatBridalLocation(body: {
  rack?: string | null;
  section?: string | null;
  hanger?: string | null;
}): string {
  const parts = [body.rack, body.section, body.hanger]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

export function isBridalLowStock(qty: number | null, reorderBelow: number | null) {
  if (qty == null || reorderBelow == null) return false;
  return qty <= reorderBelow;
}

export function flattenBridalSpecs(
  body: Record<string, unknown>
): Record<string, unknown> {
  const specs = body.item_specs;
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    return { ...body, ...(specs as Record<string, unknown>) };
  }
  return body;
}

function trimStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function bridalDateFields(body: Record<string, unknown>): {
  wedding_on: string | null;
  starts_at: string | null;
  eta_on: string | null;
} {
  const wedding =
    trimStr(body.wedding_on) ?? trimStr(body.wedding_date);
  return {
    wedding_on: wedding ? wedding.slice(0, 10) : null,
    starts_at: trimStr(body.starts_at) ?? trimStr(body.appointment_at),
    eta_on: trimStr(body.eta_on) ?? trimStr(body.expected_arrival),
  };
}
