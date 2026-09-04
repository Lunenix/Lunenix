"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_EDIT_STATUS_LABELS,
  PHOTO_EDIT_STATUSES,
} from "@/lib/photoService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function EditsPage() {
  return (
    <PhotoOpsPage
      title="Edits"
      description="Editing queue and due dates. This is not Lightroom or auto-culling."
      kind="edits"
      wrap="rows"
      fields={[
        { key: "title", label: "Job / gallery", kind: "text", required: true },
        { key: "due_on", label: "Due date", kind: "date" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PHOTO_EDIT_STATUSES, PHOTO_EDIT_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
