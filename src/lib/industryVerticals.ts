/**
 * Lunenix Business Hub industry catalog.
 * 4 master sectors, listed verticals, plus Other (custom workspace).
 * Keep slugs in sync with industry_pipeline_family in Supabase migrations.
 */

export const CUSTOM_INDUSTRY_PRESET = "other";

export type IndustrySectorId =
  | "creative_professional"
  | "home_field"
  | "event_wedding"
  | "personal_wellness"
  | "custom";

export type IndustryVertical = { value: string; label: string };

export type IndustrySector = {
  id: IndustrySectorId;
  label: string;
  verticals: IndustryVertical[];
};

export const INDUSTRY_SECTORS: IndustrySector[] = [
  {
    id: "creative_professional",
    label: "Creative & Professional Services",
    verticals: [
      { value: "architecture_spatial_design", label: "Architecture & Spatial Design" },
      { value: "art_gallery", label: "Art Gallery" },
      { value: "consulting", label: "Consulting" },
      { value: "content_creator", label: "Content Creator" },
      { value: "digital_marketing_agency", label: "Digital Marketing Agency" },
      { value: "employment_agency", label: "Employment Agency" },
      { value: "graphic_designer", label: "Graphic Designer" },
      { value: "home_based_business", label: "Home-Based Business" },
      { value: "hr_company_management", label: "HR & Company Management" },
      { value: "nonprofit", label: "Nonprofit" },
      { value: "notary_service", label: "Notary Service" },
      { value: "project_manager", label: "Project Manager" },
      { value: "real_estate_staging", label: "Real Estate & Staging" },
      { value: "real_estate_investor", label: "Real Estate Investor" },
      { value: "realtor", label: "Realtor" },
      { value: "retail_ecommerce", label: "Retail & E-Commerce" },
      { value: "sculptures_fine_art", label: "Sculptures & Fine Art" },
      { value: "talent_agency", label: "Talent Agency" },
      { value: "tax_preparer", label: "Tax Preparer" },
      { value: "travel_agency", label: "Travel Agency" },
      { value: "virtual_assistant_admin", label: "Virtual Assistant & Admin" },
      { value: "web_developer", label: "Web Developer" },
    ],
  },
  {
    id: "home_field",
    label: "Home & Field Services",
    verticals: [
      { value: "cleaning_services", label: "Cleaning Services" },
      { value: "contractors_construction", label: "General Contractors & Construction" },
      { value: "electrician", label: "Electrician" },
      { value: "handyman", label: "Handyman" },
      { value: "hvac", label: "HVAC" },
      { value: "inspection_service", label: "Inspection Service" },
      { value: "interior_design_services", label: "Interior Design Services" },
      { value: "landscaping_lawn_care", label: "Landscaping & Lawn Care" },
      { value: "painting_drywall", label: "Painting & Drywall" },
      { value: "pest_control", label: "Pest Control" },
      { value: "plumbing", label: "Plumbing" },
      { value: "rental_company", label: "Rental Company" },
      { value: "roofing_exterior_repair", label: "Roofing & Exterior Repair" },
      {
        value: "steelworking_metal_fabrication",
        label: "Steelworking & Metal Fabrication",
      },
      {
        value: "woodworking_custom_carpentry",
        label: "Woodworking & Custom Carpentry",
      },
    ],
  },
  {
    id: "event_wedding",
    label: "Event & Wedding Services",
    verticals: [
      { value: "bakery_specialty_food", label: "Bakery & Specialty Food" },
      { value: "bridal_shop", label: "Bridal Shop" },
      { value: "caterer", label: "Caterer" },
      { value: "dj_entertainment", label: "DJ & Entertainment" },
      { value: "event_decor_services", label: "Event Decor Services" },
      { value: "event_planner", label: "Event Planner" },
      { value: "event_venue", label: "Event Venue" },
      { value: "florist_floral_design", label: "Florist & Floral Design" },
      { value: "food_trucks", label: "Food Trucks" },
      { value: "hair_makeup_hmua", label: "Hair & Makeup (HMUA)" },
      { value: "mobile_bartending", label: "Mobile Bartending" },
      { value: "photography_videography", label: "Photography & Videography" },
      { value: "private_chef_services", label: "Private Chef Services" },
    ],
  },
  {
    id: "personal_wellness",
    label: "Personal & Wellness Services",
    verticals: [
      { value: "corporate_trainer", label: "Corporate Trainer" },
      { value: "doula_postpartum_care", label: "Doula & Postpartum Care" },
      { value: "esthetician_skincare", label: "Esthetician & Skincare" },
      { value: "fitness_wellness", label: "Fitness & Wellness" },
      { value: "lash_brow_specialist", label: "Lash & Brow Specialist" },
      { value: "life_coach", label: "Life Coach" },
      { value: "massage_therapy", label: "Massage Therapy" },
      { value: "nutritionist", label: "Nutritionist" },
      {
        value: "personal_stylist_image_consultant",
        label: "Personal Stylist & Image Consultant",
      },
      { value: "pet_care", label: "Pet Care" },
      { value: "tattoo_pmu", label: "Tattoo & Permanent Makeup (PMU)" },
      { value: "yoga_pilates_instructor", label: "Yoga & Pilates Instructor" },
    ],
  },
  {
    id: "custom",
    label: "Custom / Fallback",
    verticals: [
      { value: CUSTOM_INDUSTRY_PRESET, label: "Other (User-defined custom workspace)" },
    ],
  },
];

/** Flat list for validation and legacy UI. */
export const INDUSTRY_PRESETS: IndustryVertical[] = INDUSTRY_SECTORS.flatMap(
  (sector) => sector.verticals
);

/** Previous 5-preset catalog → current vertical slugs. */
export const LEGACY_INDUSTRY_PRESET_MAP: Record<string, string> = {
  bridal: "bridal_shop",
  mobile_bar: "mobile_bartending",
  contractor: "contractors_construction",
  general_contractor: "contractors_construction",
  creative: "graphic_designer",
  general: CUSTOM_INDUSTRY_PRESET,
};

export function resolveIndustryPreset(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  return LEGACY_INDUSTRY_PRESET_MAP[value] ?? value;
}

export function isIndustryPreset(value: string): boolean {
  return INDUSTRY_PRESETS.some((p) => p.value === value);
}

export function normalizeIndustryCustomLabel(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  return trimmed || null;
}

export function industryPresetsInSector(
  sectorId: IndustrySectorId
): string[] {
  return (
    INDUSTRY_SECTORS.find((s) => s.id === sectorId)?.verticals.map(
      (v) => v.value
    ) ?? []
  );
}

export function industrySectorId(
  preset?: string | null
): IndustrySectorId | null {
  const resolved = resolveIndustryPreset(preset);
  if (!resolved) return null;
  return (
    INDUSTRY_SECTORS.find((s) =>
      s.verticals.some((v) => v.value === resolved)
    )?.id ?? null
  );
}

export function industrySectorLabel(
  preset?: string | null
): string | null {
  const resolved = resolveIndustryPreset(preset);
  if (!resolved) return null;
  return (
    INDUSTRY_SECTORS.find((s) =>
      s.verticals.some((v) => v.value === resolved)
    )?.label ?? null
  );
}

export function industryDisplayLabel(
  preset?: string | null,
  customLabel?: string | null
): string {
  const resolved = resolveIndustryPreset(preset);
  if (!resolved) return "—";
  const found = INDUSTRY_PRESETS.find((p) => p.value === resolved);
  const base = found?.label ?? resolved;
  const custom = normalizeIndustryCustomLabel(customLabel);
  if (resolved === CUSTOM_INDUSTRY_PRESET && custom) {
    return `Other (${custom})`;
  }
  return base;
}
