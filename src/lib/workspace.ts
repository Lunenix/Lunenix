export {
  CUSTOM_INDUSTRY_PRESET,
  INDUSTRY_PRESETS,
  INDUSTRY_SECTORS,
  industryDisplayLabel,
  isIndustryPreset,
  normalizeIndustryCustomLabel,
} from "@/lib/industryVerticals";

export const TEAM_SIZE_OPTIONS: {
  value: string;
  label: string;
  seats: number;
}[] = [
  { value: "1-5", label: "1–5 people", seats: 5 },
  { value: "6-20", label: "6–20 people", seats: 20 },
  { value: "21-50", label: "21–50 people", seats: 50 },
  { value: "51-200", label: "51–200 people", seats: 200 },
  { value: "200+", label: "200+ people", seats: 500 },
];

export const TRIAL_DAYS = 21;

/** Included owned workspaces for non–super-admin users. Extra slots are $8 each. */
export const INCLUDED_OWNED_WORKSPACES = 1;
export const EXTRA_WORKSPACE_PRICE_USD = 8;
export const EXTRA_WORKSPACE_PRICE_CENTS = 800;

export function ownedWorkspaceAllowance(extraSlots: number): number {
  return INCLUDED_OWNED_WORKSPACES + Math.max(0, extraSlots);
}

export function seatsForTeamSize(teamSize: string | null | undefined): number {
  return TEAM_SIZE_OPTIONS.find((o) => o.value === teamSize)?.seats ?? 5;
}

export function trialEndsAt(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d.toISOString();
}

export function isTeamSize(value: string): boolean {
  return TEAM_SIZE_OPTIONS.some((o) => o.value === value);
}
