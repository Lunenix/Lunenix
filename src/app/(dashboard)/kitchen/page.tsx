"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import {
  CATERING_PREP_STATUS_LABELS,
  CATERING_PREP_STATUSES,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function KitchenPage() {
  return (
    <CateringOpsPage
      title="Kitchen prep"
      description="Prep tasks working backward from service: station, assignee, batch checklist, equipment needs. Unassigned tasks alert as staffing gaps."
      kind="prep"
      wrap="rows"
      fields={[
        { key: "title", label: "Task", kind: "text", required: true },
        { key: "due_at", label: "Due", kind: "datetime-local" },
        { key: "station", label: "Station", kind: "text" },
        { key: "assignee_name", label: "Assignee", kind: "text" },
        { key: "checklist", label: "Prep checklist", kind: "textarea" },
        { key: "equipment_needs", label: "Equipment needs", kind: "textarea", list: false },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(CATERING_PREP_STATUSES, CATERING_PREP_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
