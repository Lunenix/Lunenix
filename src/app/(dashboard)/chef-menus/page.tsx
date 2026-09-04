"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";
import {
  CHEF_MENU_KIND_LABELS,
  CHEF_MENU_KINDS,
  CHEF_MENU_STATUS_LABELS,
  CHEF_MENU_STATUSES,
} from "@/lib/chefService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function ChefMenusPage() {
  return (
    <ChefOpsPage
      title="Menus"
      description="Weekly or event menus with dishes and nutrition notes. Mark Pending for client approval alerts. This is not auto-generated from a recipe database."
      kind="menus"
      wrap="rows"
      fields={[
        { key: "title", label: "Menu / week", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(CHEF_MENU_KINDS, CHEF_MENU_KIND_LABELS),
        },
        { key: "dishes", label: "Dishes", kind: "textarea" },
        { key: "nutrition_notes", label: "Recipe / nutrition notes", kind: "textarea" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(CHEF_MENU_STATUSES, CHEF_MENU_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
