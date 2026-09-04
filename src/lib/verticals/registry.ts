import {
  INDUSTRY_PRESETS,
  industryPresetsInSector,
  industrySectorId,
  resolveIndustryPreset,
} from "@/lib/industryVerticals";
import type { FunctionDeclaration } from "@google/genai";
import type { VerticalNavItem, VerticalPack } from "@/lib/verticals/types";
import { mobileBartendingPack } from "@/lib/verticals/packs/mobile-bartending";
import { eventPlannerPack } from "@/lib/verticals/packs/event-planner";
import { eventVenuePack } from "@/lib/verticals/packs/event-venue";
import { bridalShopPack } from "@/lib/verticals/packs/bridal-shop";
import { catererPack } from "@/lib/verticals/packs/caterer";
import { privateChefPack } from "@/lib/verticals/packs/private-chef";
import { photographyVideographyPack } from "@/lib/verticals/packs/photography-videography";
import { SUPER_ADMIN_TOOLS } from "@/lib/luna-super-admin-tools";

/** Nav/ops packs keyed by pack id (`field`, `bar`, …). Not an industries table. */
export const VERTICAL_REGISTRY: Record<string, VerticalPack> = {};

export function registerVerticalPack(pack: VerticalPack): void {
  VERTICAL_REGISTRY[pack.id] = pack;
}

export function listVerticalPacks(): readonly VerticalPack[] {
  return Object.values(VERTICAL_REGISTRY);
}

export function getVerticalPacks(
  industryPreset?: string | null
): VerticalPack[] {
  const resolved = resolveIndustryPreset(industryPreset);
  if (!resolved) return [];
  const sector = industrySectorId(resolved);
  return listVerticalPacks().filter((pack) => {
    if (pack.presets.includes(resolved)) return true;
    if (pack.presets.length === 0 && pack.sector && pack.sector === sector) {
      return true;
    }
    return false;
  });
}

export function verticalNavFor(
  industryPreset?: string | null
): VerticalNavItem[] {
  return getVerticalPacks(industryPreset).flatMap((pack) => [...pack.nav]);
}

export function shouldHideProjectsNav(
  industryPreset?: string | null
): boolean {
  return getVerticalPacks(industryPreset).some((pack) => pack.hideProjectsNav);
}

const FIELD_CORE_NAV: VerticalNavItem[] = [
  { href: "/field", label: "Field ops", icon: "Wrench" },
  { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
  { href: "/jobs", label: "Jobs", icon: "FolderKanban" },
  { href: "/inventory", label: "Inventory", icon: "Package" },
  { href: "/books", label: "Books", icon: "BookOpen" },
  { href: "/mileage", label: "Mileage", icon: "MapPin" },
  { href: "/team", label: "Techs", icon: "HardHat" },
];

const FIELD_TRADE_NAV: Record<string, VerticalNavItem[]> = {
  hvac: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/materials", label: "Materials", icon: "Truck" },
    { href: "/change-orders", label: "Change orders", icon: "FilePen" },
    { href: "/plans", label: "Recurring", icon: "Repeat" },
  ],
  electrician: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
  ],
  plumbing: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
  ],
  handyman: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
  ],
  landscaping_lawn_care: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/plans", label: "Recurring", icon: "Repeat" },
  ],
  roofing_exterior_repair: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/claims", label: "Claims", icon: "Shield" },
    { href: "/materials", label: "Materials", icon: "Truck" },
  ],
  painting_drywall: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/colors", label: "Colors", icon: "Palette" },
    { href: "/prep", label: "Prep", icon: "Paintbrush" },
  ],
  pest_control: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/treatments", label: "Treatments", icon: "Bug" },
    { href: "/access", label: "Access", icon: "KeyRound" },
    { href: "/plans", label: "Recurring", icon: "Repeat" },
  ],
  inspection_service: [
    { href: "/findings", label: "Findings", icon: "ClipboardCheck" },
    { href: "/reports", label: "Reports", icon: "FileText" },
    { href: "/addons", label: "Add-ons", icon: "Layers" },
  ],
  rental_company: [
    { href: "/fleet", label: "Fleet", icon: "Warehouse" },
    { href: "/rentals", label: "Rentals", icon: "CalendarRange" },
    { href: "/maintenance", label: "Maintenance", icon: "Cog" },
  ],
  contractors_construction: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/change-orders", label: "Change orders", icon: "FilePen" },
    { href: "/subs", label: "Subs", icon: "UsersRound" },
    { href: "/phases", label: "Phases", icon: "ChartGantt" },
    { href: "/daily-logs", label: "Daily logs", icon: "Notebook" },
    { href: "/draws", label: "Draws", icon: "Landmark" },
    { href: "/materials", label: "Materials", icon: "Truck" },
  ],
  woodworking_custom_carpentry: [
    { href: "/designs", label: "Designs", icon: "PencilRuler" },
    { href: "/selections", label: "Selections", icon: "TreePine" },
    { href: "/shop", label: "Shop", icon: "Hammer" },
  ],
  steelworking_metal_fabrication: [
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/drawings", label: "Drawings", icon: "Compass" },
    { href: "/specs", label: "Specs", icon: "Cylinder" },
    { href: "/fab", label: "Fab", icon: "Factory" },
    { href: "/welds", label: "Welds", icon: "Flame" },
    { href: "/materials", label: "Materials", icon: "Truck" },
  ],
  cleaning_services: [
    { href: "/plans", label: "Recurring", icon: "Repeat" },
    { href: "/access", label: "Access", icon: "KeyRound" },
  ],
  interior_design_services: [
    { href: "/designs", label: "Designs", icon: "PencilRuler" },
    { href: "/selections", label: "Selections", icon: "TreePine" },
    { href: "/colors", label: "Colors", icon: "Palette" },
  ],
};

/** Shared Home & Field core. Trade extras are separate packs so nav never merges. */
registerVerticalPack({
  id: "field",
  presets: industryPresetsInSector("home_field"),
  sector: "home_field",
  hideProjectsNav: true,
  nav: FIELD_CORE_NAV,
});

for (const [preset, nav] of Object.entries(FIELD_TRADE_NAV)) {
  registerVerticalPack({
    id: `field-${preset}`,
    presets: [preset],
    sector: "home_field",
    nav,
  });
}

registerVerticalPack({
  id: "bar",
  presets: ["mobile_bartending"],
  sector: "event_wedding",
  workflowPrefix: "Bar:",
  nav: [
    { href: "/bar", label: "Bar ops", icon: "Wine" },
    { href: "/events", label: "Events", icon: "PartyPopper" },
    { href: "/menus", label: "Menus", icon: "Martini" },
    { href: "/looks", label: "Looks", icon: "Images" },
    { href: "/compliance", label: "Compliance", icon: "ShieldCheck" },
    { href: "/bar-orders", label: "Bar orders", icon: "ShoppingBag" },
    { href: "/crew", label: "Crew", icon: "UserRound" },
    { href: "/onsite", label: "On-site", icon: "Camera" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
  ],
});

registerVerticalPack({
  id: "planner",
  presets: ["event_planner"],
  sector: "event_wedding",
  workflowPrefix: "Planner:",
  hideProjectsNav: true,
  nav: [
    { href: "/planner", label: "Planner ops", icon: "CalendarHeart" },
    { href: "/events", label: "Events", icon: "PartyPopper" },
    { href: "/vision", label: "Vision", icon: "Images" },
    { href: "/layouts", label: "Layouts", icon: "LayoutGrid" },
    { href: "/budget", label: "Budget", icon: "Wallet" },
    { href: "/event-vendors", label: "Vendors", icon: "Store" },
    { href: "/guests", label: "Guests", icon: "UserCheck" },
    { href: "/timeline", label: "Timeline", icon: "ChartGantt" },
    { href: "/coordinators", label: "Coordinators", icon: "UserCog" },
    { href: "/event-rentals", label: "Event rentals", icon: "Armchair" },
    { href: "/day-of", label: "Day-of", icon: "Camera" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
  ],
});

registerVerticalPack({
  id: "venue",
  presets: ["event_venue"],
  sector: "event_wedding",
  workflowPrefix: "Venue:",
  hideProjectsNav: true,
  nav: [
    { href: "/venue", label: "Venue ops", icon: "Landmark" },
    { href: "/events", label: "Events", icon: "PartyPopper" },
    { href: "/spaces", label: "Spaces", icon: "DoorOpen" },
    { href: "/tours", label: "Tours", icon: "CalendarCheck" },
    { href: "/preferred-vendors", label: "Preferred vendors", icon: "Store" },
    { href: "/venue-policies", label: "Policies", icon: "ScrollText" },
    { href: "/venue-compliance", label: "Insurance", icon: "ShieldCheck" },
    { href: "/venue-layouts", label: "Layouts", icon: "LayoutGrid" },
    { href: "/venue-staff", label: "Staff", icon: "UserCog" },
    { href: "/turnover", label: "Turnover", icon: "Timer" },
    { href: "/venue-maintenance", label: "Facility", icon: "Cog" },
    { href: "/venue-day-of", label: "Condition photos", icon: "Camera" },
    { href: "/damage-deposits", label: "Damage deposits", icon: "CircleDollarSign" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
  ],
});

registerVerticalPack({
  id: "bridal",
  presets: ["bridal_shop"],
  sector: "event_wedding",
  workflowPrefix: "Bridal:",
  hideProjectsNav: true,
  nav: [
    { href: "/bridal", label: "Bridal ops", icon: "Sparkles" },
    { href: "/appointments", label: "Appointments", icon: "CalendarCheck" },
    { href: "/floor-map", label: "Floor map", icon: "MapPinned" },
    { href: "/gowns", label: "Floor inventory", icon: "Shirt" },
    { href: "/bridal-style", label: "Style matching", icon: "Images" },
    { href: "/fittings", label: "Fittings", icon: "Camera" },
    { href: "/bridal-orders", label: "Orders", icon: "ShoppingBag" },
    { href: "/alterations", label: "Alterations", icon: "Scissors" },
    { href: "/bridal-party", label: "Bridal party", icon: "UsersRound" },
    { href: "/bridal-staff", label: "Staff", icon: "UserCog" },
    { href: "/receiving", label: "Receiving", icon: "Package" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
  ],
});

registerVerticalPack({
  id: "catering",
  presets: ["caterer"],
  sector: "event_wedding",
  workflowPrefix: "Catering:",
  hideProjectsNav: true,
  nav: [
    { href: "/catering", label: "Catering ops", icon: "UtensilsCrossed" },
    { href: "/events", label: "Events", icon: "PartyPopper" },
    { href: "/tastings", label: "Tastings", icon: "CalendarCheck" },
    { href: "/catering-menus", label: "Menus", icon: "Soup" },
    { href: "/catering-style", label: "Presentation", icon: "Images" },
    { href: "/catering-compliance", label: "Health & licenses", icon: "ShieldCheck" },
    { href: "/food-orders", label: "Food orders", icon: "ShoppingBag" },
    { href: "/kitchen", label: "Kitchen prep", icon: "CookingPot" },
    { href: "/catering-staff", label: "Staff", icon: "UserCog" },
    { href: "/catering-equipment", label: "Equipment", icon: "Warehouse" },
    { href: "/catering-day-of", label: "Service log", icon: "Thermometer" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
  ],
});

registerVerticalPack({
  id: "chef",
  presets: ["private_chef_services"],
  sector: "event_wedding",
  workflowPrefix: "Chef:",
  hideProjectsNav: true,
  nav: [
    { href: "/chef", label: "Chef ops", icon: "ChefHat" },
    { href: "/events", label: "Visits", icon: "PartyPopper" },
    { href: "/households", label: "Households", icon: "Home" },
    { href: "/chef-style", label: "Inspiration", icon: "Images" },
    { href: "/chef-menus", label: "Menus", icon: "Salad" },
    { href: "/chef-plans", label: "Recurring", icon: "Repeat" },
    { href: "/access-notes", label: "Access notes", icon: "KeyRound" },
    { href: "/shopping", label: "Shopping", icon: "ShoppingCart" },
    { href: "/labels", label: "Labels", icon: "Tag" },
    { href: "/chef-staff", label: "Chefs", icon: "UserCog" },
    { href: "/chef-kit", label: "Chef kit", icon: "Refrigerator" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
  ],
});

registerVerticalPack({
  id: "photo",
  presets: ["photography_videography"],
  sector: "event_wedding",
  workflowPrefix: "Photo:",
  hideProjectsNav: true,
  nav: [
    { href: "/photo", label: "Photo ops", icon: "Camera" },
    { href: "/events", label: "Shoots", icon: "PartyPopper" },
    { href: "/photo-packages", label: "Packages", icon: "Layers" },
    { href: "/photo-style", label: "Mood boards", icon: "Images" },
    { href: "/shot-list", label: "Shot list", icon: "Clapperboard" },
    { href: "/photo-permits", label: "Permits", icon: "ClipboardCheck" },
    { href: "/edits", label: "Edits", icon: "Film" },
    { href: "/galleries", label: "Galleries", icon: "Aperture" },
    { href: "/print-orders", label: "Prints", icon: "ShoppingBag" },
    { href: "/releases", label: "Releases", icon: "ScrollText" },
    { href: "/photo-crew", label: "Crew", icon: "UserCog" },
    { href: "/photo-gear", label: "Gear", icon: "Package" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
  ],
});

/** Catalog sector label. Tool packs key off `industry_preset`, not this string. */
export const EVENT_WEDDING_CATEGORY = "Event & Wedding Services";

type VerticalLunaPack = {
  key: string;
  name: string;
  tools: readonly FunctionDeclaration[];
};

const VERTICAL_TOOL_REGISTRY: Record<string, VerticalLunaPack> = {
  [mobileBartendingPack.key]: mobileBartendingPack,
  [eventPlannerPack.key]: eventPlannerPack,
  [eventVenuePack.key]: eventVenuePack,
  [bridalShopPack.key]: bridalShopPack,
  [catererPack.key]: catererPack,
  [privateChefPack.key]: privateChefPack,
  [photographyVideographyPack.key]: photographyVideographyPack,
};

/** Resolve a Luna tool pack by `industry_preset` slug or catalog label. */
export function getVerticalPack(
  industryPreset?: string | null
): VerticalLunaPack | null {
  if (!industryPreset) return null;
  const direct = VERTICAL_TOOL_REGISTRY[industryPreset];
  if (direct) return direct;
  const resolved = resolveIndustryPreset(industryPreset);
  if (resolved && VERTICAL_TOOL_REGISTRY[resolved]) {
    return VERTICAL_TOOL_REGISTRY[resolved];
  }
  const byLabel = INDUSTRY_PRESETS.find((p) => p.label === industryPreset);
  if (byLabel && VERTICAL_TOOL_REGISTRY[byLabel.value]) {
    return VERTICAL_TOOL_REGISTRY[byLabel.value];
  }
  return null;
}

export function getToolsForWorkspace(
  baseTools: FunctionDeclaration[],
  industryPreset?: string | null
): FunctionDeclaration[] {
  const pack = getVerticalPack(industryPreset);
  if (!pack || !pack.tools.length) return baseTools;
  return [...baseTools, ...pack.tools];
}

/** Chat tool list. Pack tools plus platform-owner admin tools. */
export function getLunaChatTools(
  baseTools: FunctionDeclaration[],
  industryPreset?: string | null
): FunctionDeclaration[] {
  return [...getToolsForWorkspace(baseTools, industryPreset), ...SUPER_ADMIN_TOOLS];
}

export function listVerticalLunaPacks(): {
  key: string;
  name: string;
  toolCount: number;
}[] {
  return Object.values(VERTICAL_TOOL_REGISTRY).map((pack) => ({
    key: pack.key,
    name: pack.name,
    toolCount: pack.tools.length,
  }));
}

export function isRegisteredPackTool(toolName: string): boolean {
  return Object.values(VERTICAL_TOOL_REGISTRY).some((pack) =>
    pack.tools.some((t) => t.name === toolName)
  );
}
