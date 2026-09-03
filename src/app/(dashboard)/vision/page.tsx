"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import {
  PLANNER_REVIEW_STATUS_LABELS,
  PLANNER_REVIEW_STATUSES,
  PLANNER_VISION_KIND_LABELS,
  PLANNER_VISION_KINDS,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VisionPage() {
  return (
    <PlannerOpsPage
      title="Design vision"
      description="Wish-wall and mood-board image URLs plus client review. This is not a Pinterest embed or composite editor."
      kind="vision"
      wrap="rows"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(PLANNER_VISION_KINDS, PLANNER_VISION_KIND_LABELS),
        },
        { key: "image_url", label: "Image URL", kind: "text" },
        {
          key: "client_status",
          label: "Client review",
          kind: "select",
          options: opts(PLANNER_REVIEW_STATUSES, PLANNER_REVIEW_STATUS_LABELS),
        },
        { key: "notes", label: "Must-haves / avoid", kind: "textarea", list: false },
      ]}
    />
  );
}
