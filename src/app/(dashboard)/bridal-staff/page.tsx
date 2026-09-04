"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";
import {
  BRIDAL_CREW_ROLE_LABELS,
  BRIDAL_CREW_ROLES,
} from "@/lib/bridalService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BridalStaffPage() {
  return (
    <BridalOpsPage
      title="Staff"
      description="Stylists and seamstresses. Conversion and upsell notes are text — not an automatic appointments-to-sales dashboard."
      kind="crew"
      wrap="crew"
      fields={[
        { key: "name", label: "Name", kind: "text", required: true },
        {
          key: "role",
          label: "Role",
          kind: "select",
          options: opts(BRIDAL_CREW_ROLES, BRIDAL_CREW_ROLE_LABELS),
        },
        { key: "conversion_notes", label: "Conversion / upsell notes", kind: "textarea" },
        { key: "rating", label: "Rating", kind: "number" },
        { key: "notes", label: "Availability / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
