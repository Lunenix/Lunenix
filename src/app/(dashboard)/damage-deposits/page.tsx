"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_DAMAGE_STATUS_LABELS,
  VENUE_DAMAGE_STATUSES,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function DamageDepositsPage() {
  return (
    <VenueOpsPage
      title="Damage deposits"
      description="Held, refunded, or deducted amounts with assessment notes. Pair with condition photos. Refunds go through Invoices/Books — Luna never collects cards."
      kind="deposits"
      wrap="rows"
      fields={[
        { key: "title", label: "Booking / label", kind: "text", required: true },
        { key: "amount", label: "Amount", kind: "number" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(VENUE_DAMAGE_STATUSES, VENUE_DAMAGE_STATUS_LABELS),
        },
        { key: "assessment_notes", label: "Condition assessment", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
