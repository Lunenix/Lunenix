import { resolveIndustryPreset } from "@/lib/industryVerticals";

export function isPrivateChefWorkspace(
  industryPreset?: string | null
): boolean {
  return resolveIndustryPreset(industryPreset) === "private_chef_services";
}

export const CHEF_LEAD_SOURCES = [
  "Weekly meal prep",
  "Dinner party",
  "Special occasion",
  "Recurring household chef",
  "Referral",
] as const;

export const CHEF_SERVICE_TYPES = [
  "meal_prep",
  "dinner_party",
  "recurring_chef",
  "other",
] as const;
export type ChefServiceType = (typeof CHEF_SERVICE_TYPES)[number];
export const CHEF_SERVICE_TYPE_LABELS: Record<ChefServiceType, string> = {
  meal_prep: "Weekly meal prep",
  dinner_party: "Dinner party / one-off",
  recurring_chef: "Recurring in-home chef",
  other: "Other",
};

export const CHEF_VISIT_STATUSES = [
  "scheduled",
  "shopping",
  "cooking",
  "complete",
  "skipped",
] as const;
export type ChefVisitStatus = (typeof CHEF_VISIT_STATUSES)[number];
export const CHEF_VISIT_STATUS_LABELS: Record<ChefVisitStatus, string> = {
  scheduled: "Scheduled",
  shopping: "Shopping",
  cooking: "Cooking",
  complete: "Complete",
  skipped: "Skipped / paused",
};

export const CHEF_MENU_KINDS = ["weekly", "event"] as const;
export type ChefMenuKind = (typeof CHEF_MENU_KINDS)[number];
export const CHEF_MENU_KIND_LABELS: Record<ChefMenuKind, string> = {
  weekly: "Weekly / recurring",
  event: "One-off event",
};

export const CHEF_MENU_STATUSES = ["draft", "pending", "approved"] as const;
export type ChefMenuStatus = (typeof CHEF_MENU_STATUSES)[number];
export const CHEF_MENU_STATUS_LABELS: Record<ChefMenuStatus, string> = {
  draft: "Draft",
  pending: "Pending approval",
  approved: "Approved",
};

export const CHEF_PLAN_FREQUENCIES = ["weekly", "biweekly"] as const;
export type ChefPlanFrequency = (typeof CHEF_PLAN_FREQUENCIES)[number];
export const CHEF_PLAN_FREQUENCY_LABELS: Record<ChefPlanFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
};

export const CHEF_ENTRY_METHODS = [
  "key",
  "code",
  "present",
  "housekeeper",
] as const;
export type ChefEntryMethod = (typeof CHEF_ENTRY_METHODS)[number];
export const CHEF_ENTRY_METHOD_LABELS: Record<ChefEntryMethod, string> = {
  key: "Key",
  code: "Code",
  present: "Client present",
  housekeeper: "Housekeeper coordination",
};

export function flattenChefSpecs(
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

export function chefVisitDateFields(body: Record<string, unknown>): {
  visit_on: string | null;
  starts_at: string | null;
} {
  const d = trimStr(body.visit_on) ?? trimStr(body.event_date) ?? trimStr(body.event_on);
  return {
    visit_on: d ? d.slice(0, 10) : null,
    starts_at: trimStr(body.starts_at) ?? trimStr(body.consult_at),
  };
}
