"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_MAINT_KIND_LABELS,
  VENUE_MAINT_KINDS,
  VENUE_MAINT_STATUS_LABELS,
  VENUE_MAINT_STATUSES,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VenueMaintenancePage() {
  return (
    <VenueOpsPage
      title="Facility & equipment"
      description="Tables, chairs, AV, lighting, HVAC, and vendor repair scheduling. Shared Inventory still holds stock counts."
      kind="maintenance"
      wrap="rows"
      fields={[
        { key: "title", label: "Item", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(VENUE_MAINT_KINDS, VENUE_MAINT_KIND_LABELS),
        },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(VENUE_MAINT_STATUSES, VENUE_MAINT_STATUS_LABELS),
        },
        { key: "next_service_on", label: "Next service", kind: "date" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
