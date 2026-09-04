"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";
import {
  CHEF_SERVICE_TYPE_LABELS,
  CHEF_SERVICE_TYPES,
} from "@/lib/chefService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function HouseholdsPage() {
  return (
    <ChefOpsPage
      title="Households"
      description="Dietary profile, favorites, never-make list, meal times, and portions. Access details live on Access notes."
      kind="profiles"
      wrap="rows"
      fields={[
        { key: "title", label: "Household / client", kind: "text", required: true },
        {
          key: "service_type",
          label: "Service type",
          kind: "select",
          options: opts(CHEF_SERVICE_TYPES, CHEF_SERVICE_TYPE_LABELS),
        },
        { key: "household_size", label: "Household size", kind: "number" },
        { key: "budget_range", label: "Budget range", kind: "text" },
        { key: "lead_source", label: "Lead source", kind: "text", list: false },
        { key: "allergies", label: "Allergies", kind: "textarea" },
        { key: "dietary_notes", label: "Restrictions", kind: "textarea", list: false },
        { key: "health_goals", label: "Health goals", kind: "textarea", list: false },
        { key: "dislikes", label: "Dislikes", kind: "textarea", list: false },
        { key: "favorites", label: "Favorites / cuisines", kind: "textarea", list: false },
        { key: "never_make", label: "Never make this", kind: "textarea", list: false },
        { key: "meal_times", label: "Meal times", kind: "text", list: false },
        { key: "portions", label: "Portion counts", kind: "text", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
