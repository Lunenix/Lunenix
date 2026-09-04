"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_ORDER_STATUS_LABELS,
  PHOTO_ORDER_STATUSES,
} from "@/lib/photoService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function PrintOrdersPage() {
  return (
    <PhotoOpsPage
      title="Prints & albums"
      description="Album and print orders with vendor notes. This is not a live lab portal."
      kind="orders"
      wrap="rows"
      fields={[
        { key: "title", label: "Order", kind: "text", required: true },
        { key: "vendor_name", label: "Lab / vendor", kind: "text" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PHOTO_ORDER_STATUSES, PHOTO_ORDER_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
