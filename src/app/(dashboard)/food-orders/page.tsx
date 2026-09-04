"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import {
  CATERING_ORDER_STATUS_LABELS,
  CATERING_ORDER_STATUSES,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function FoodOrdersPage() {
  return (
    <CateringOpsPage
      title="Food orders"
      description="Purveyor orders scaled in notes to guest count. Waste/leftover notes for cost control. This is not auto-scale from recipes."
      kind="orders"
      wrap="rows"
      fields={[
        { key: "title", label: "Order", kind: "text", required: true },
        { key: "purveyor", label: "Purveyor", kind: "text" },
        { key: "delivery_on", label: "Delivery", kind: "date" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(CATERING_ORDER_STATUSES, CATERING_ORDER_STATUS_LABELS),
        },
        { key: "waste_notes", label: "Waste / leftover notes", kind: "textarea" },
        { key: "notes", label: "Items / qty notes", kind: "textarea", list: false },
      ]}
    />
  );
}
