"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";

export default function ChefKitPage() {
  return (
    <ChefOpsPage
      title="Chef kit"
      description="Knives, appliances, and pantry staples the chef brings. Set reorder-below for low-stock alerts."
      kind="equipment"
      wrap="rows"
      fields={[
        { key: "title", label: "Item", kind: "text", required: true },
        { key: "qty", label: "Qty", kind: "number" },
        { key: "reorder_below", label: "Reorder below", kind: "number" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
