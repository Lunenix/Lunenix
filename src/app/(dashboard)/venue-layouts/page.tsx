"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_LAYOUT_TYPE_LABELS,
  VENUE_LAYOUT_TYPES,
  VENUE_REVIEW_STATUS_LABELS,
  VENUE_REVIEW_STATUSES,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VenueLayoutsPage() {
  return (
    <VenueOpsPage
      title="Layouts"
      description="Layout type, listed capacity, photo URL, and client approval. This is not a live floor-plan builder."
      kind="layouts"
      wrap="rows"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        { key: "space_name", label: "Space", kind: "text" },
        {
          key: "layout_type",
          label: "Layout",
          kind: "select",
          options: opts(VENUE_LAYOUT_TYPES, VENUE_LAYOUT_TYPE_LABELS),
        },
        { key: "capacity", label: "Capacity for this layout", kind: "number" },
        { key: "photo_url", label: "Photo URL", kind: "text" },
        {
          key: "client_status",
          label: "Client review",
          kind: "select",
          options: opts(VENUE_REVIEW_STATUSES, VENUE_REVIEW_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
