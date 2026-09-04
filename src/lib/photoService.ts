import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isPhotographyWorkspace(
  industryPreset?: string | null
): boolean {
  return resolveIndustryPreset(industryPreset) === "photography_videography";
}

export const PHOTO_LEAD_SOURCES = [
  "Wedding",
  "Engagement",
  "Family / portrait",
  "Commercial",
  "Referral",
] as const;

export const PHOTO_SHOOT_TYPES = [
  "wedding",
  "engagement",
  "family",
  "commercial",
  "other",
] as const;
export type PhotoShootType = (typeof PHOTO_SHOOT_TYPES)[number];
export const PHOTO_SHOOT_TYPE_LABELS: Record<PhotoShootType, string> = {
  wedding: "Wedding",
  engagement: "Engagement",
  family: "Family / portrait",
  commercial: "Commercial",
  other: "Other",
};

export const PHOTO_COVERAGE = ["photo", "video", "both"] as const;
export type PhotoCoverage = (typeof PHOTO_COVERAGE)[number];
export const PHOTO_COVERAGE_LABELS: Record<PhotoCoverage, string> = {
  photo: "Photography",
  video: "Videography",
  both: "Photo + video",
};

export const PHOTO_SHOOT_STATUSES = [
  "inquiry",
  "booked",
  "shooting",
  "editing",
  "delivered",
  "cancelled",
] as const;
export type PhotoShootStatus = (typeof PHOTO_SHOOT_STATUSES)[number];
export const PHOTO_SHOOT_STATUS_LABELS: Record<PhotoShootStatus, string> = {
  inquiry: "Inquiry",
  booked: "Booked",
  shooting: "On shoot",
  editing: "Editing",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PHOTO_SHOT_STATUSES = ["planned", "captured", "skip"] as const;
export type PhotoShotStatus = (typeof PHOTO_SHOT_STATUSES)[number];
export const PHOTO_SHOT_STATUS_LABELS: Record<PhotoShotStatus, string> = {
  planned: "Planned",
  captured: "Captured",
  skip: "Skip",
};

export const PHOTO_EDIT_STATUSES = ["queued", "in_progress", "delivered"] as const;
export type PhotoEditStatus = (typeof PHOTO_EDIT_STATUSES)[number];
export const PHOTO_EDIT_STATUS_LABELS: Record<PhotoEditStatus, string> = {
  queued: "Queued",
  in_progress: "In progress",
  delivered: "Delivered",
};

export const PHOTO_GALLERY_STATUSES = ["draft", "sent", "expired"] as const;
export type PhotoGalleryStatus = (typeof PHOTO_GALLERY_STATUSES)[number];
export const PHOTO_GALLERY_STATUS_LABELS: Record<PhotoGalleryStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  expired: "Expired",
};

export const PHOTO_ORDER_STATUSES = ["needed", "ordered", "delivered"] as const;
export type PhotoOrderStatus = (typeof PHOTO_ORDER_STATUSES)[number];
export const PHOTO_ORDER_STATUS_LABELS: Record<PhotoOrderStatus, string> = {
  needed: "Needed",
  ordered: "Ordered",
  delivered: "Delivered",
};

export function flattenPhotoSpecs(
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

export function photoShootDateFields(body: Record<string, unknown>): {
  shoot_on: string | null;
  starts_at: string | null;
} {
  const d =
    trimStr(body.shoot_on) ?? trimStr(body.event_date) ?? trimStr(body.event_on);
  return {
    shoot_on: d ? d.slice(0, 10) : null,
    starts_at: trimStr(body.starts_at) ?? trimStr(body.consult_at),
  };
}
