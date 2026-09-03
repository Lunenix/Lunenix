"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import { PLANNER_RSVP, PLANNER_RSVP_LABELS } from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function GuestsPage() {
  return (
    <PlannerOpsPage
      title="Guest list & RSVP"
      description="RSVP, meal, dietary, and table name. Seating is a field on the guest — not a drag-and-drop chart. Tie table names to layout notes."
      kind="guests"
      wrap="guests"
      fields={[
        { key: "name", label: "Guest", kind: "text", required: true },
        {
          key: "rsvp",
          label: "RSVP",
          kind: "select",
          options: opts(PLANNER_RSVP, PLANNER_RSVP_LABELS),
        },
        { key: "meal", label: "Meal", kind: "text" },
        { key: "dietary", label: "Dietary", kind: "text", list: false },
        { key: "table_name", label: "Table", kind: "text" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
