"use client";

import { BarOpsPage } from "@/components/bar/BarOpsPage";
import {
  BAR_INCIDENT_KIND_LABELS,
  BAR_INCIDENT_KINDS,
  BAR_ONSITE_KIND_LABELS,
  BAR_ONSITE_KINDS,
} from "@/lib/barService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BarOnsitePage() {
  return (
    <BarOpsPage
      title="On-site"
      description="Setup photos, consumption notes for overage billing, and incident logs (refusals, spills). Photo URLs only — not a live camera roll."
      kind="onsite"
      wrap="rows"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(BAR_ONSITE_KINDS, BAR_ONSITE_KIND_LABELS),
        },
        { key: "image_url", label: "Photo URL", kind: "text" },
        {
          key: "incident_kind",
          label: "Incident type",
          kind: "select",
          options: opts(BAR_INCIDENT_KINDS, BAR_INCIDENT_KIND_LABELS),
          list: false,
        },
        { key: "notes", label: "Notes", kind: "textarea" },
      ]}
    />
  );
}
