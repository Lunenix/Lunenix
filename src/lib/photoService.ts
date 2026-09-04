import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isPhotographyWorkspace(
  industryPreset?: string | null
): boolean {
  return resolveIndustryPreset(industryPreset) === "photography_videography";
}

export const PHOTO_LEAD_SOURCES = [
  "Wedding",
  "Portrait session",
  "Corporate / commercial",
  "Referral",
  "Instagram / portfolio",
] as const;

export const PHOTO_SHOOT_TYPES = [
  "wedding",
  "engagement",
  "family",
  "commercial",
  "headshots",
  "product",
  "event",
  "other",
] as const;
export type PhotoShootType = (typeof PHOTO_SHOOT_TYPES)[number];
export const PHOTO_SHOOT_TYPE_LABELS: Record<PhotoShootType, string> = {
  wedding: "Wedding",
  engagement: "Engagement",
  family: "Family / portrait",
  commercial: "Commercial",
  headshots: "Headshots",
  product: "Product",
  event: "Event",
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
  "wrapped",
  "editing",
  "delivered",
  "cancelled",
] as const;
export type PhotoShootStatus = (typeof PHOTO_SHOOT_STATUSES)[number];
export const PHOTO_SHOOT_STATUS_LABELS: Record<PhotoShootStatus, string> = {
  inquiry: "Inquiry",
  booked: "Booked",
  shooting: "On shoot",
  wrapped: "Wrapped",
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

export const PHOTO_EDIT_STATUSES = [
  "culling",
  "editing",
  "grading",
  "review",
  "delivered",
] as const;
export type PhotoEditStatus = (typeof PHOTO_EDIT_STATUSES)[number];
export const PHOTO_EDIT_STATUS_LABELS: Record<PhotoEditStatus, string> = {
  culling: "Culling",
  editing: "Editing",
  grading: "Color grading",
  review: "Client review",
  delivered: "Ready for delivery",
};

export const PHOTO_VIDEO_STAGES = [
  "none",
  "rough_cut",
  "client_review",
  "final_cut",
] as const;
export type PhotoVideoStage = (typeof PHOTO_VIDEO_STAGES)[number];
export const PHOTO_VIDEO_STAGE_LABELS: Record<PhotoVideoStage, string> = {
  none: "No video",
  rough_cut: "Rough cut",
  client_review: "Video client review",
  final_cut: "Final cut / mix",
};

export const PHOTO_DELIVERY_METHODS = [
  "download",
  "usb",
  "album",
  "file",
] as const;
export type PhotoDeliveryMethod = (typeof PHOTO_DELIVERY_METHODS)[number];
export const PHOTO_DELIVERY_METHOD_LABELS: Record<PhotoDeliveryMethod, string> =
  {
    download: "Download link",
    usb: "USB",
    album: "Album",
    file: "Video file",
  };

export const PHOTO_PERMIT_STATUSES = [
  "needed",
  "submitted",
  "approved",
] as const;
export type PhotoPermitStatus = (typeof PHOTO_PERMIT_STATUSES)[number];
export const PHOTO_PERMIT_STATUS_LABELS: Record<PhotoPermitStatus, string> = {
  needed: "Needed",
  submitted: "Submitted",
  approved: "Approved",
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

/** Map spoken session types onto photo_shoots.shoot_type. */
export function mapPhotoSessionType(raw: unknown): PhotoShootType {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s.includes("wedding")) return "wedding";
  if (s.includes("engagement")) return "engagement";
  if (s.includes("headshot")) return "headshots";
  if (s.includes("product")) return "product";
  if (s.includes("commercial") || s.includes("corporate")) return "commercial";
  if (s.includes("portrait") || s.includes("family")) return "family";
  if (s.includes("event")) return "event";
  return "other";
}

/** Map culling/edit labels onto photo_edits.status. */
export function mapPhotoEditStage(raw: unknown): PhotoEditStatus {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (
    s.includes("deliver") ||
    s.includes("ready") ||
    s.includes("final") ||
    s.includes("complete")
  ) {
    return "delivered";
  }
  if (s.includes("review")) return "review";
  if (s.includes("grad") || s.includes("color")) return "grading";
  if (s.includes("cull") || s.includes("pending") || s === "queued") {
    return "culling";
  }
  return "editing";
}

export function photoShotListFromArgs(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 40);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 40);
  }
  return [];
}
