"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import {
  PLANNER_SEGMENT_LABELS,
  PLANNER_SEGMENTS,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function TimelinePage() {
  return (
    <PlannerOpsPage
      title="Timeline"
      description="Setup through breakdown with coordinator and vendor names. Share by email — this is not a live vendor portal."
      kind="timeline"
      wrap="rows"
      fields={[
        { key: "title", label: "Segment title", kind: "text", required: true },
        {
          key: "segment",
          label: "Part of day",
          kind: "select",
          options: opts(PLANNER_SEGMENTS, PLANNER_SEGMENT_LABELS),
        },
        { key: "starts_at", label: "Start", kind: "datetime-local" },
        { key: "ends_at", label: "End", kind: "datetime-local", list: false },
        { key: "assignee_name", label: "Coordinator", kind: "text" },
        { key: "vendor_name", label: "Vendor", kind: "text", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
