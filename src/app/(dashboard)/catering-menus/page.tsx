"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import {
  CATERING_STYLE_LABELS,
  CATERING_STYLES,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function CateringMenusPage() {
  return (
    <CateringOpsPage
      title="Menus"
      description="Service style plus apps, entrees, sides, and desserts as text. Tasting feedback can live here or on Tastings. This is not a live recipe database."
      kind="menus"
      wrap="rows"
      fields={[
        { key: "title", label: "Menu name", kind: "text", required: true },
        {
          key: "service_style",
          label: "Service style",
          kind: "select",
          options: opts(CATERING_STYLES, CATERING_STYLE_LABELS),
        },
        { key: "courses", label: "Courses (apps, entrees, sides, desserts)", kind: "textarea" },
        { key: "tasting_notes", label: "Tasting notes", kind: "textarea", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
