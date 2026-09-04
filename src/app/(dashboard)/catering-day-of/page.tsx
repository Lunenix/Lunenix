"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import {
  CATERING_ONSITE_KIND_LABELS,
  CATERING_ONSITE_KINDS,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function CateringDayOfPage() {
  return (
    <CateringOpsPage
      title="Service log"
      description="Presentation photos (URL), hot/cold holding temperatures, and incident notes. This is a typed log, not a wireless probe."
      kind="onsite"
      wrap="rows"
      fields={[
        { key: "title", label: "Title", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(CATERING_ONSITE_KINDS, CATERING_ONSITE_KIND_LABELS),
        },
        { key: "image_url", label: "Photo URL", kind: "text" },
        { key: "temp_f", label: "Temp °F", kind: "number" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
