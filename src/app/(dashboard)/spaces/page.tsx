"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";

export default function VenueSpacesPage() {
  return (
    <VenueOpsPage
      title="Spaces"
      description="Rooms and outdoor areas with banquet, theater, and cocktail capacity. Availability is on Events by date and space name."
      kind="spaces"
      wrap="spaces"
      fields={[
        { key: "name", label: "Space name", kind: "text", required: true },
        { key: "capacity_banquet", label: "Banquet capacity", kind: "number" },
        { key: "capacity_theater", label: "Theater capacity", kind: "number" },
        { key: "capacity_cocktail", label: "Cocktail capacity", kind: "number" },
        { key: "notes", label: "Amenities / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
