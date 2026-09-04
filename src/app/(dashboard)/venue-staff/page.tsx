"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_CREW_ROLE_LABELS,
  VENUE_CREW_ROLES,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VenueStaffPage() {
  return (
    <VenueOpsPage
      title="Staff"
      description="Coordinators, setup crew, security, and in-house bartenders. Store TIPS or security cert text. Availability is notes plus the calendar — not a live roster."
      kind="crew"
      wrap="crew"
      fields={[
        { key: "name", label: "Name", kind: "text", required: true },
        {
          key: "role",
          label: "Role",
          kind: "select",
          options: opts(VENUE_CREW_ROLES, VENUE_CREW_ROLE_LABELS),
        },
        { key: "cert", label: "Cert (TIPS, security license)", kind: "text" },
        { key: "rating", label: "Rating", kind: "number" },
        { key: "notes", label: "Availability / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
