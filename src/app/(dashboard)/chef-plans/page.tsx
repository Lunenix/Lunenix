"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";
import {
  CHEF_PLAN_FREQUENCIES,
  CHEF_PLAN_FREQUENCY_LABELS,
} from "@/lib/chefService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function ChefPlansPage() {
  return (
    <ChefOpsPage
      title="Recurring plans"
      description="Weekly or biweekly household plans. Pause or skip in notes. This does not auto-fill the calendar or auto-charge cards."
      kind="plans"
      wrap="rows"
      fields={[
        { key: "title", label: "Household / plan", kind: "text", required: true },
        {
          key: "frequency",
          label: "Frequency",
          kind: "select",
          options: opts(CHEF_PLAN_FREQUENCIES, CHEF_PLAN_FREQUENCY_LABELS),
        },
        {
          key: "paused",
          label: "Paused",
          kind: "select",
          options: [
            { value: "false", label: "Active" },
            { value: "true", label: "Paused" },
          ],
        },
        { key: "skip_notes", label: "Skip / travel notes", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
