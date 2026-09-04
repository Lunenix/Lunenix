"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_TURNOVER_STATUS_LABELS,
  VENUE_TURNOVER_STATUSES,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VenueTurnoverPage() {
  return (
    <VenueOpsPage
      title="Turnover"
      description="Cleaning/reset between back-to-back events. Mark Too tight when buffer hours are not enough — Venue ops will alert. This does not auto-block the calendar."
      kind="turnovers"
      wrap="rows"
      fields={[
        { key: "title", label: "Turnover", kind: "text", required: true },
        { key: "from_event", label: "From event", kind: "text" },
        { key: "to_event", label: "To event", kind: "text" },
        { key: "buffer_hours", label: "Buffer hours", kind: "number" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(VENUE_TURNOVER_STATUSES, VENUE_TURNOVER_STATUS_LABELS),
        },
        { key: "condition_notes", label: "Condition check", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
