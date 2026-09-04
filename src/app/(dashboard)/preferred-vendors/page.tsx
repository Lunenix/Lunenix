"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_VENDOR_CATEGORIES,
  VENUE_VENDOR_CATEGORY_LABELS,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function PreferredVendorsPage() {
  return (
    <VenueOpsPage
      title="Preferred vendors"
      description="Approved caterer, bar, and rental lists, plus whether the venue requires them. Track vendor COI dates here. This is not a live vendor portal."
      kind="vendors"
      wrap="vendors"
      fields={[
        { key: "name", label: "Vendor", kind: "text", required: true },
        {
          key: "category",
          label: "Category",
          kind: "select",
          options: opts(VENUE_VENDOR_CATEGORIES, VENUE_VENDOR_CATEGORY_LABELS),
        },
        {
          key: "preferred",
          label: "Preferred list",
          kind: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
        },
        {
          key: "required_inhouse",
          label: "Required in-house",
          kind: "select",
          options: [
            { value: "false", label: "Optional / outside OK" },
            { value: "true", label: "Required" },
          ],
        },
        { key: "coi_expires_on", label: "COI expires", kind: "date" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
