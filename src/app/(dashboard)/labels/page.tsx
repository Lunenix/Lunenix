"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";

export default function LabelsPage() {
  return (
    <ChefOpsPage
      title="Labels"
      description="Dish name, date made, reheating, shelf life, and allergy cross-contamination notes."
      kind="labels"
      wrap="rows"
      fields={[
        { key: "title", label: "Dish", kind: "text", required: true },
        { key: "made_on", label: "Date made", kind: "date" },
        { key: "reheat_notes", label: "Reheating", kind: "textarea" },
        { key: "shelf_life", label: "Shelf life", kind: "text" },
        { key: "allergy_precautions", label: "Allergy precautions", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
