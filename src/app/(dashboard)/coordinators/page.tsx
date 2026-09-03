"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import {
  PLANNER_CREW_ROLE_LABELS,
  PLANNER_CREW_ROLES,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function CoordinatorsPage() {
  return (
    <PlannerOpsPage
      title="Coordinators"
      description="Lead, assistants, and setup crew. Day-of availability is a note — GPS auto-route is not live. Rating is optional post-event."
      kind="crew"
      wrap="crew"
      fields={[
        { key: "name", label: "Name", kind: "text", required: true },
        {
          key: "role",
          label: "Role",
          kind: "select",
          options: opts(PLANNER_CREW_ROLES, PLANNER_CREW_ROLE_LABELS),
        },
        { key: "rating", label: "Post-event rating", kind: "number", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
