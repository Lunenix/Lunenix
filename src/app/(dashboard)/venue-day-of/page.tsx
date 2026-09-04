"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_ONSITE_KIND_LABELS,
  VENUE_ONSITE_KINDS,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VenueDayOfPage() {
  return (
    <VenueOpsPage
      title="Condition photos"
      description="Before/after photos (URL), incidents, and post-event walkthrough. Use these with damage deposits. This is not automatic OCR."
      kind="onsite"
      wrap="rows"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(VENUE_ONSITE_KINDS, VENUE_ONSITE_KIND_LABELS),
        },
        { key: "image_url", label: "Photo URL", kind: "text" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
