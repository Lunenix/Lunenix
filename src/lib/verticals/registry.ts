import {
  industrySectorId,
  resolveIndustryPreset,
} from "@/lib/industryVerticals";
import type { VerticalNavItem, VerticalPack } from "@/lib/verticals/types";

const PACKS: VerticalPack[] = [];

export function registerVerticalPack(pack: VerticalPack): void {
  const i = PACKS.findIndex((p) => p.id === pack.id);
  if (i >= 0) {
    PACKS[i] = pack;
    return;
  }
  PACKS.push(pack);
}

export function listVerticalPacks(): readonly VerticalPack[] {
  return PACKS;
}

export function getVerticalPacks(
  industryPreset?: string | null
): VerticalPack[] {
  const resolved = resolveIndustryPreset(industryPreset);
  if (!resolved) return [];
  const sector = industrySectorId(resolved);
  return PACKS.filter((pack) => {
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
