"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import {
  CATERING_CREW_ROLE_LABELS,
  CATERING_CREW_ROLES,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function CateringStaffPage() {
  return (
    <CateringOpsPage
      title="Staff"
      description="Chefs, servers, bartenders, captains. Store food-handler or alcohol cert text. Availability is notes plus the calendar."
      kind="crew"
      wrap="crew"
      fields={[
        { key: "name", label: "Name", kind: "text", required: true },
        {
          key: "role",
          label: "Role",
          kind: "select",
          options: opts(CATERING_CREW_ROLES, CATERING_CREW_ROLE_LABELS),
        },
        { key: "cert", label: "Cert (food handler, TIPS)", kind: "text" },
        { key: "rating", label: "Rating", kind: "number" },
        { key: "notes", label: "Availability / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
