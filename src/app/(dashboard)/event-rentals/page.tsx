"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import {
  PLANNER_RENTAL_STATUS_LABELS,
  PLANNER_RENTAL_STATUSES,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function EventRentalsPage() {
  return (
    <PlannerOpsPage
      title="Event rentals"
      description="Linens, chairs, decor, lighting — vendor or planner-owned. Delivery/pickup dates. Owned inventory also lives on Inventory."
      kind="rentals"
      wrap="rentals"
      fields={[
        { key: "item_name", label: "Item", kind: "text", required: true },
        { key: "vendor_name", label: "Vendor", kind: "text" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PLANNER_RENTAL_STATUSES, PLANNER_RENTAL_STATUS_LABELS),
        },
        { key: "delivery_on", label: "Delivery", kind: "date" },
        { key: "pickup_on", label: "Pickup", kind: "date", list: false },
        {
          key: "owned",
          label: "Planner-owned",
          kind: "select",
          options: [
            { value: "false", label: "Vendor" },
            { value: "true", label: "Owned" },
          ],
          list: false,
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
