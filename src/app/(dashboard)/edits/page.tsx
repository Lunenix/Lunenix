"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_EDIT_STATUS_LABELS,
  PHOTO_EDIT_STATUSES,
  PHOTO_VIDEO_STAGE_LABELS,
  PHOTO_VIDEO_STAGES,
} from "@/lib/photoService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function EditsPage() {
  return (
    <PhotoOpsPage
      title="Edits"
      description="Culling → editing → color grading → client review → delivery. Video stages are separate. This is not Lightroom, auto-culling, or an outsourced editor portal."
      kind="edits"
      wrap="rows"
      fields={[
        { key: "title", label: "Job / gallery", kind: "text", required: true },
        { key: "editor_name", label: "Editor (in-house or outsourced)", kind: "text" },
        { key: "due_on", label: "Turnaround due", kind: "date" },
        {
          key: "status",
          label: "Photo stage",
          kind: "select",
          options: opts(PHOTO_EDIT_STATUSES, PHOTO_EDIT_STATUS_LABELS),
        },
        {
          key: "video_stage",
          label: "Video stage",
          kind: "select",
          options: opts(PHOTO_VIDEO_STAGES, PHOTO_VIDEO_STAGE_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
