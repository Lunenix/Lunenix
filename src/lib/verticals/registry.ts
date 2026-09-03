import {
  INDUSTRY_PRESETS,
  industrySectorId,
  resolveIndustryPreset,
} from "@/lib/industryVerticals";
import type { FunctionDeclaration } from "@google/genai";
import type { VerticalNavItem, VerticalPack } from "@/lib/verticals/types";
import { mobileBartendingPack } from "@/lib/verticals/packs/mobile-bartending";
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

/** Home & Field extras. Per-trade workflow prefixes stay in catalogDefaultWorkflows until moved. */
registerVerticalPack({
  id: "field",
  presets: [],
  sector: "home_field",
  hideProjectsNav: true,
  nav: [
    { href: "/field", label: "Field ops", icon: "Wrench" },
    { href: "/estimates", label: "Estimates", icon: "ClipboardSignature" },
    { href: "/jobs", label: "Jobs", icon: "FolderKanban" },
    { href: "/inventory", label: "Inventory", icon: "Package" },
    { href: "/books", label: "Books", icon: "BookOpen" },
    { href: "/mileage", label: "Mileage", icon: "MapPin" },
    { href: "/permits", label: "Permits", icon: "ClipboardList" },
    { href: "/change-orders", label: "Change orders", icon: "FilePen" },
    { href: "/subs", label: "Subs", icon: "UsersRound" },
    { href: "/phases", label: "Phases", icon: "ChartGantt" },
    { href: "/daily-logs", label: "Daily logs", icon: "Notebook" },
    { href: "/draws", label: "Draws", icon: "Landmark" },
    { href: "/designs", label: "Designs", icon: "PencilRuler" },
    { href: "/selections", label: "Selections", icon: "TreePine" },
    { href: "/shop", label: "Shop", icon: "Hammer" },
    { href: "/drawings", label: "Drawings", icon: "Compass" },
    { href: "/specs", label: "Specs", icon: "Cylinder" },
    { href: "/fab", label: "Fab", icon: "Factory" },
    { href: "/welds", label: "Welds", icon: "Flame" },
    { href: "/claims", label: "Claims", icon: "Shield" },
    { href: "/materials", label: "Materials", icon: "Truck" },
    { href: "/colors", label: "Colors", icon: "Palette" },
    { href: "/prep", label: "Prep", icon: "Paintbrush" },
    { href: "/treatments", label: "Treatments", icon: "Bug" },
    { href: "/access", label: "Access", icon: "KeyRound" },
    { href: "/findings", label: "Findings", icon: "ClipboardCheck" },
    { href: "/reports", label: "Reports", icon: "FileText" },
    { href: "/addons", label: "Add-ons", icon: "Layers" },
    { href: "/fleet", label: "Fleet", icon: "Warehouse" },
    { href: "/rentals", label: "Rentals", icon: "CalendarRange" },
    { href: "/maintenance", label: "Maintenance", icon: "Cog" },
    { href: "/plans", label: "Recurring", icon: "Repeat" },
    { href: "/team", label: "Techs", icon: "HardHat" },
  ],
});

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

/** Catalog sector label. Tool packs key off `industry_preset`, not this string. */
export const EVENT_WEDDING_CATEGORY = "Event & Wedding Services";

type VerticalLunaPack = {
  key: string;
  name: string;
  tools: readonly FunctionDeclaration[];
};

const VERTICAL_TOOL_REGISTRY: Record<string, VerticalLunaPack> = {
  [mobileBartendingPack.key]: mobileBartendingPack,
  // Additional Event & Wedding packs (Florist, DJ, Caterer, Venue) register here
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
