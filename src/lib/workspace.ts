/** Industry presets used for pipeline seeding. Keep in sync with seed_pipeline_stages. */
export const INDUSTRY_PRESETS: { value: string; label: string }[] = [
  { value: "bridal", label: "Bridal / Specialty Retail" },
  { value: "mobile_bar", label: "Mobile Bar / Catering" },
  { value: "contractor", label: "Trade Contractor" },
  { value: "creative", label: "Creative Studio" },
  { value: "general", label: "General Business" },
];

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

export function seatsForTeamSize(teamSize: string | null | undefined): number {
  return TEAM_SIZE_OPTIONS.find((o) => o.value === teamSize)?.seats ?? 5;
}

export function trialEndsAt(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d.toISOString();
}

export function isIndustryPreset(value: string): boolean {
  return INDUSTRY_PRESETS.some((p) => p.value === value);
}

export function isTeamSize(value: string): boolean {
  return TEAM_SIZE_OPTIONS.some((o) => o.value === value);
}
