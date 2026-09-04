"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";

export default function PhotoStylePage() {
  return (
    <PhotoOpsPage
      title="Mood boards"
      description="Inspiration URLs and style notes. This is not a live Pinterest board."
      kind="mood"
      wrap="rows"
      fields={[
        { key: "title", label: "Board / couple", kind: "text", required: true },
        { key: "image_url", label: "Inspiration image URL", kind: "text" },
        { key: "style_notes", label: "Style notes", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
