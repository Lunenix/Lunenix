"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import {
  PLANNER_ONSITE_KIND_LABELS,
  PLANNER_ONSITE_KINDS,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function DayOfPage() {
  return (
    <PlannerOpsPage
      title="Day-of"
      description="Setup photos, issue log (no-show, timeline change), and walkthrough photo URLs. Not a live livestream."
      kind="onsite"
      wrap="rows"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(PLANNER_ONSITE_KINDS, PLANNER_ONSITE_KIND_LABELS),
        },
        { key: "image_url", label: "Photo URL", kind: "text" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
