"use client";

import { BarOpsPage } from "@/components/bar/BarOpsPage";
import {
  BAR_MENU_STATUS_LABELS,
  BAR_MENU_STATUSES,
  BAR_PACKAGE_TIER_LABELS,
  BAR_PACKAGE_TIERS,
  BAR_SETUP_STYLE_LABELS,
  BAR_SETUP_STYLES,
} from "@/lib/barService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BarMenusPage() {
  return (
    <BarOpsPage
      title="Menus & packages"
      description="Bar package tiers, signature cocktails, mocktails, dietary notes, and setup style. Link garnish colors to the event theme on Events."
      kind="menus"
      wrap="menus"
      fields={[
        { key: "name", label: "Menu name", kind: "text", required: true },
        {
          key: "package_tier",
          label: "Package",
          kind: "select",
          options: opts(BAR_PACKAGE_TIERS, BAR_PACKAGE_TIER_LABELS),
        },
        {
          key: "setup_style",
          label: "Setup style",
          kind: "select",
          options: opts(BAR_SETUP_STYLES, BAR_SETUP_STYLE_LABELS),
        },
        { key: "cocktails", label: "Signature cocktails", kind: "textarea" },
        { key: "mocktails", label: "Mocktails", kind: "textarea", list: false },
        { key: "dietary_notes", label: "Dietary / allergy notes", kind: "textarea", list: false },
        { key: "garnish_notes", label: "Garnish / color notes", kind: "textarea", list: false },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BAR_MENU_STATUSES, BAR_MENU_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
