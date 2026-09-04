"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";
import {
  CHEF_ENTRY_METHOD_LABELS,
  CHEF_ENTRY_METHODS,
} from "@/lib/chefService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function AccessNotesPage() {
  return (
    <ChefOpsPage
      title="Access notes"
      description="Entry method, kitchen equipment on hand vs bring list, pets, fridge/freezer labeling. Store codes in notes with care — Luna context is sanitized to titles."
      kind="access"
      wrap="rows"
      fields={[
        { key: "title", label: "Household", kind: "text", required: true },
        {
          key: "entry_method",
          label: "Entry",
          kind: "select",
          options: opts(CHEF_ENTRY_METHODS, CHEF_ENTRY_METHOD_LABELS),
        },
        { key: "entry_notes", label: "Entry notes", kind: "textarea" },
        { key: "kitchen_on_hand", label: "Kitchen on hand", kind: "textarea" },
        { key: "bring_list", label: "Chef brings", kind: "textarea", list: false },
        { key: "pet_notes", label: "Pets / household", kind: "textarea", list: false },
        { key: "storage_notes", label: "Storage / labeling prefs", kind: "textarea", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
