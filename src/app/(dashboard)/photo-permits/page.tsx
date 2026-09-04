"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_PERMIT_STATUS_LABELS,
  PHOTO_PERMIT_STATUSES,
} from "@/lib/photoService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function PhotoPermitsPage() {
  return (
    <PhotoOpsPage
      title="Shoot permits"
      description="Park and venue permit status. This is a checklist, not a live permit portal."
      kind="permits"
      wrap="rows"
      fields={[
        { key: "title", label: "Permit / location", kind: "text", required: true },
        { key: "venue_name", label: "Venue / park", kind: "text" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PHOTO_PERMIT_STATUSES, PHOTO_PERMIT_STATUS_LABELS),
        },
        { key: "due_on", label: "Due", kind: "date" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
