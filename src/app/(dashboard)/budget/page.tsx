"use client";

import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import {
  PLANNER_BUDGET_CATEGORIES,
  PLANNER_BUDGET_CATEGORY_LABELS,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BudgetPage() {
  return (
    <PlannerOpsPage
      title="Event budget"
      description="Planned vs actual by category. Change-orders after approval go in notes. Luna never collects cards. Shared invoices and vendor bills stay on Invoices and Books."
      kind="budget"
      wrap="rows"
      fields={[
        { key: "label", label: "Line", kind: "text", required: true },
        {
          key: "category",
          label: "Category",
          kind: "select",
          options: opts(PLANNER_BUDGET_CATEGORIES, PLANNER_BUDGET_CATEGORY_LABELS),
        },
        { key: "planned_amount", label: "Planned", kind: "number" },
        { key: "actual_amount", label: "Actual", kind: "number" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
