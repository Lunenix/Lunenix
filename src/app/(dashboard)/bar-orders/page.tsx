"use client";

import { BarOpsPage } from "@/components/bar/BarOpsPage";
import {
  BAR_ORDER_KIND_LABELS,
  BAR_ORDER_KINDS,
  BAR_ORDER_STATUS_LABELS,
  BAR_ORDER_STATUSES,
} from "@/lib/barService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BarOrdersPage() {
  return (
    <BarOpsPage
      title="Alcohol & supply orders"
      description="Vendor orders for alcohol, mixers, garnish, glassware, and ice. Leftover/return notes live here. Receipt OCR is not auto-filled — attach files on Books."
      kind="orders"
      wrap="orders"
      fields={[
        { key: "vendor_name", label: "Vendor / liquor store", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(BAR_ORDER_KINDS, BAR_ORDER_KIND_LABELS),
        },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BAR_ORDER_STATUSES, BAR_ORDER_STATUS_LABELS),
        },
        { key: "pickup_on", label: "Pickup / delivery", kind: "date" },
        { key: "leftover_notes", label: "Leftover / return", kind: "textarea", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
