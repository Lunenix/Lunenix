"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";

export default function LayoutsPage() {
  return (
    <PlannerOpsPage
      title="Venue & layout"
      description="Venue photo URL plus notes for tables, dance floor, bar, and seating. This is not a live floor-plan or seating-chart builder."
      kind="layouts"
      wrap="rows"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        { key: "venue_photo_url", label: "Venue photo URL", kind: "text" },
        { key: "layout_notes", label: "Layout notes", kind: "textarea" },
        { key: "seating_notes", label: "Seating notes", kind: "textarea", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
