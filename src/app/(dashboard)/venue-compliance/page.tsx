"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_COMPLIANCE_KIND_LABELS,
  VENUE_COMPLIANCE_KINDS,
  VENUE_COMPLIANCE_STATUS_LABELS,
  VENUE_COMPLIANCE_STATUSES,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VenueCompliancePage() {
  return (
    <VenueOpsPage
      title="Insurance & licenses"
      description="Client event insurance, vendor COIs, and the venue liquor license. Missing or expiring items alert on Venue ops."
      kind="compliance"
      wrap="rows"
      fields={[
        { key: "title", label: "Item", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(VENUE_COMPLIANCE_KINDS, VENUE_COMPLIANCE_KIND_LABELS),
        },
        { key: "expires_on", label: "Expires", kind: "date" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(
            VENUE_COMPLIANCE_STATUSES,
            VENUE_COMPLIANCE_STATUS_LABELS
          ),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
