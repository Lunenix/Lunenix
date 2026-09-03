import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isEventPlannerWorkspace(
  industryPreset?: string | null
): boolean {
  return resolveIndustryPreset(industryPreset) === "event_planner";
}

export const PLANNER_EVENT_TYPES = [
  "wedding",
  "corporate",
  "private_party",
  "other",
] as const;
export type PlannerEventType = (typeof PLANNER_EVENT_TYPES)[number];
export const PLANNER_EVENT_TYPE_LABELS: Record<PlannerEventType, string> = {
  wedding: "Wedding",
  corporate: "Corporate",
  private_party: "Private party",
  other: "Other",
};

export const PLANNER_LEAD_SOURCES = [
  "Wedding",
  "Corporate event",
  "Private party",
  "Referral",
  "Venue partnership",
] as const;

export const PLANNER_TIERS = ["full", "partial", "day_of"] as const;
export type PlannerTier = (typeof PLANNER_TIERS)[number];
export const PLANNER_TIER_LABELS: Record<PlannerTier, string> = {
  full: "Full planning",
  partial: "Partial planning",
  day_of: "Day-of coordination",
};

export const PLANNER_EVENT_STATUSES = [
  "inquiry",
  "booked",
  "completed",
  "cancelled",
] as const;
export type PlannerEventStatus = (typeof PLANNER_EVENT_STATUSES)[number];
export const PLANNER_EVENT_STATUS_LABELS: Record<PlannerEventStatus, string> = {
  inquiry: "Inquiry",
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PLANNER_VISION_KINDS = ["wish", "mood", "suggestion"] as const;
export type PlannerVisionKind = (typeof PLANNER_VISION_KINDS)[number];
export const PLANNER_VISION_KIND_LABELS: Record<PlannerVisionKind, string> = {
  wish: "Client wish wall",
  mood: "Mood board",
  suggestion: "Planner suggestion",
};

export const PLANNER_REVIEW_STATUSES = [
  "pending",
  "approved",
  "revision",
] as const;
export type PlannerReviewStatus = (typeof PLANNER_REVIEW_STATUSES)[number];
export const PLANNER_REVIEW_STATUS_LABELS: Record<PlannerReviewStatus, string> =
  {
    pending: "Pending review",
    approved: "Approved",
    revision: "Revision",
  };

export const PLANNER_BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "florals",
  "entertainment",
  "rentals",
  "attire",
  "other",
] as const;
export type PlannerBudgetCategory = (typeof PLANNER_BUDGET_CATEGORIES)[number];
export const PLANNER_BUDGET_CATEGORY_LABELS: Record<
  PlannerBudgetCategory,
  string
> = {
  venue: "Venue",
  catering: "Catering",
  florals: "Florals",
  entertainment: "Entertainment",
  rentals: "Rentals",
  attire: "Attire",
  other: "Other",
};

export const PLANNER_VENDOR_CATEGORIES = [
  "caterer",
  "florist",
  "dj",
  "photographer",
  "rentals",
  "transportation",
  "other",
] as const;
export type PlannerVendorCategory = (typeof PLANNER_VENDOR_CATEGORIES)[number];
export const PLANNER_VENDOR_CATEGORY_LABELS: Record<
  PlannerVendorCategory,
  string
> = {
  caterer: "Caterer",
  florist: "Florist",
  dj: "DJ / band",
  photographer: "Photographer",
  rentals: "Rentals",
  transportation: "Transportation",
  other: "Other",
};

export const PLANNER_VENDOR_STATUSES = [
  "sourcing",
  "proposed",
  "booked",
  "paid",
] as const;
export type PlannerVendorStatus = (typeof PLANNER_VENDOR_STATUSES)[number];
export const PLANNER_VENDOR_STATUS_LABELS: Record<PlannerVendorStatus, string> =
  {
    sourcing: "Sourcing",
    proposed: "Proposal in",
    booked: "Booked",
    paid: "Paid",
  };

export const PLANNER_RSVP = ["pending", "attending", "declined"] as const;
export type PlannerRsvp = (typeof PLANNER_RSVP)[number];
export const PLANNER_RSVP_LABELS: Record<PlannerRsvp, string> = {
  pending: "Pending",
  attending: "Attending",
  declined: "Declined",
};

export const PLANNER_SEGMENTS = [
  "setup",
  "ceremony",
  "cocktail",
  "reception",
  "breakdown",
] as const;
export type PlannerSegment = (typeof PLANNER_SEGMENTS)[number];
export const PLANNER_SEGMENT_LABELS: Record<PlannerSegment, string> = {
  setup: "Setup",
  ceremony: "Ceremony",
  cocktail: "Cocktail hour",
  reception: "Reception",
  breakdown: "Breakdown",
};

export const PLANNER_CREW_ROLES = ["lead", "assistant", "setup"] as const;
export type PlannerCrewRole = (typeof PLANNER_CREW_ROLES)[number];
export const PLANNER_CREW_ROLE_LABELS: Record<PlannerCrewRole, string> = {
  lead: "Lead coordinator",
  assistant: "Assistant",
  setup: "Setup crew",
};

export const PLANNER_RENTAL_STATUSES = [
  "needed",
  "ordered",
  "delivered",
  "returned",
] as const;
export type PlannerRentalStatus = (typeof PLANNER_RENTAL_STATUSES)[number];
export const PLANNER_RENTAL_STATUS_LABELS: Record<PlannerRentalStatus, string> =
  {
    needed: "Needed",
    ordered: "Ordered",
    delivered: "Delivered",
    returned: "Returned",
  };

export const PLANNER_ONSITE_KINDS = [
  "setup_photo",
  "issue",
  "walkthrough",
] as const;
export type PlannerOnsiteKind = (typeof PLANNER_ONSITE_KINDS)[number];
export const PLANNER_ONSITE_KIND_LABELS: Record<PlannerOnsiteKind, string> = {
  setup_photo: "Setup photo",
  issue: "Day-of issue",
  walkthrough: "Final walkthrough",
};

export function isPlannerCoiAlert(expiresOn: string | null): boolean {
  if (!expiresOn) return false;
  const d = new Date(expiresOn + "T00:00:00");
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  return d <= soon;
}

export function flattenPlannerSpecs(
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

export function plannerEventDateFields(body: Record<string, unknown>): {
  event_on: string | null;
  consult_at: string | null;
} {
  const eventDate = trimStr(body.event_date);
  const eventOnRaw = trimStr(body.event_on) ?? eventDate;
  return {
    event_on: eventOnRaw ? eventOnRaw.slice(0, 10) : null,
    consult_at: trimStr(body.consult_at),
  };
}
