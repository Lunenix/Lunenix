"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";

export default function PhotoGearPage() {
  return (
    <PhotoOpsPage
      title="Gear"
      description="Bodies, lenses, lights, and audio. Set reorder-below for low-stock alerts."
      kind="gear"
      wrap="rows"
      fields={[
        { key: "title", label: "Item", kind: "text", required: true },
        { key: "qty", label: "Qty", kind: "number" },
        { key: "reorder_below", label: "Reorder below", kind: "number" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
