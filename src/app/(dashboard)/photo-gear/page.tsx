"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";

export default function PhotoGearPage() {
  return (
    <PhotoOpsPage
      title="Gear"
      description="Bodies, lenses, drones, serials, insurance notes, and checkout. Maintenance dates go in notes. This is not a live GPS tracker."
      kind="gear"
      wrap="rows"
      fields={[
        { key: "title", label: "Item", kind: "text", required: true },
        { key: "serial_no", label: "Serial", kind: "text" },
        { key: "condition", label: "Condition", kind: "text" },
        { key: "qty", label: "Qty", kind: "number" },
        { key: "reorder_below", label: "Reorder below", kind: "number" },
        {
          key: "checked_out",
          label: "Checked out",
          kind: "select",
          options: [
            { value: "false", label: "In" },
            { value: "true", label: "Out" },
          ],
        },
        { key: "checked_to", label: "Checked to", kind: "text", list: false },
        { key: "insurance_notes", label: "Insurance", kind: "textarea", list: false },
        { key: "notes", label: "Service / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
