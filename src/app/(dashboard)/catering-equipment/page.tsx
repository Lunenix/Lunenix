"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import {
  CATERING_EQUIP_KIND_LABELS,
  CATERING_EQUIP_KINDS,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function CateringEquipmentPage() {
  return (
    <CateringOpsPage
      title="Equipment"
      description="Kitchen, transport, serving ware, and outside rentals. Set reorder-below for low-stock alerts. Shared Inventory still holds bulk stock."
      kind="equipment"
      wrap="rows"
      fields={[
        { key: "title", label: "Item", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(CATERING_EQUIP_KINDS, CATERING_EQUIP_KIND_LABELS),
        },
        { key: "qty", label: "Qty", kind: "number" },
        { key: "reorder_below", label: "Reorder below", kind: "number" },
        { key: "condition_notes", label: "Condition / maintenance", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
