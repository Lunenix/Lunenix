"use client";

import { BarOpsPage } from "@/components/bar/BarOpsPage";
import {
  BAR_LOOK_KIND_LABELS,
  BAR_LOOK_KINDS,
  BAR_LOOK_STATUS_LABELS,
  BAR_LOOK_STATUSES,
} from "@/lib/barService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BarLooksPage() {
  return (
    <BarOpsPage
      title="Looks & inspiration"
      description="Mock-up URLs (cart, backdrop, signage) and client wish-wall images. This is not a full composite editor — store photo links and approval status."
      kind="looks"
      wrap="looks"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(BAR_LOOK_KINDS, BAR_LOOK_KIND_LABELS),
        },
        { key: "image_url", label: "Image URL", kind: "text" },
        { key: "venue_photo_url", label: "Venue photo URL", kind: "text", list: false },
        {
          key: "client_status",
          label: "Client review",
          kind: "select",
          options: opts(BAR_LOOK_STATUSES, BAR_LOOK_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
