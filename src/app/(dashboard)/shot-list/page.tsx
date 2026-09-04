"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_SHOT_STATUS_LABELS,
  PHOTO_SHOT_STATUSES,
} from "@/lib/photoService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function ShotListPage() {
  return (
    <PhotoOpsPage
      title="Shot list"
      description="Production shots by scene and priority. This is a typed list, not a live camera ingest or Lightroom catalog."
      kind="shots"
      wrap="rows"
      fields={[
        { key: "title", label: "Shot", kind: "text", required: true },
        { key: "scene", label: "Scene / time", kind: "text" },
        { key: "priority", label: "Priority", kind: "text" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PHOTO_SHOT_STATUSES, PHOTO_SHOT_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
