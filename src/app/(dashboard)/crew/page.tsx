"use client";

import { BarOpsPage } from "@/components/bar/BarOpsPage";
import { BAR_CREW_ROLE_LABELS, BAR_CREW_ROLES } from "@/lib/barService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BarCrewPage() {
  return (
    <BarOpsPage
      title="Crew"
      description="Bartenders and barbacks: TIPS and food-handler dates, plus a simple rating. Assign people on the Events staffing notes."
      kind="crew"
      wrap="crew"
      fields={[
        { key: "name", label: "Name", kind: "text", required: true },
        {
          key: "role",
          label: "Role",
          kind: "select",
          options: opts(BAR_CREW_ROLES, BAR_CREW_ROLE_LABELS),
        },
        { key: "tips_expires_on", label: "TIPS expires", kind: "date" },
        {
          key: "food_handler_expires_on",
          label: "Food handler expires",
          kind: "date",
          list: false,
        },
        { key: "rating", label: "Rating (1–5)", kind: "number" },
        { key: "notes", label: "Notes / availability", kind: "textarea", list: false },
      ]}
    />
  );
}
