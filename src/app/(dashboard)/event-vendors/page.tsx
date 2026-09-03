"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import {
  PLANNER_VENDOR_CATEGORIES,
  PLANNER_VENDOR_CATEGORY_LABELS,
  PLANNER_VENDOR_STATUS_LABELS,
  PLANNER_VENDOR_STATUSES,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function EventVendorsPage() {
  return (
    <PlannerOpsPage
      title="Vendors"
      description="Directory, sourcing status, COI expiry, and payment notes per caterer, florist, DJ, photographer, rentals, or transport. Contracts still use e-sign. Bills go on Books."
      kind="vendors"
      wrap="vendors"
      fields={[
        { key: "name", label: "Vendor", kind: "text", required: true },
        {
          key: "category",
          label: "Category",
          kind: "select",
          options: opts(PLANNER_VENDOR_CATEGORIES, PLANNER_VENDOR_CATEGORY_LABELS),
        },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PLANNER_VENDOR_STATUSES, PLANNER_VENDOR_STATUS_LABELS),
        },
        { key: "coi_expires_on", label: "COI expires", kind: "date" },
        { key: "payment_notes", label: "Payment notes", kind: "text", list: false },
        { key: "notes", label: "Communication log", kind: "textarea", list: false },
      ]}
    />
  );
}
