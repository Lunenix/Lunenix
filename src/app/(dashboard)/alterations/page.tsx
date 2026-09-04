"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";
import {
  BRIDAL_ALT_STATUS_LABELS,
  BRIDAL_ALT_STATUSES,
} from "@/lib/bridalService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function AlterationsPage() {
  return (
    <BridalOpsPage
      title="Alterations"
      description="Measurements, in-house or outsourced seamstress, next fitting, progress photo URL. Status: measured through ready for pickup."
      kind="alterations"
      wrap="rows"
      fields={[
        { key: "title", label: "Client / gown", kind: "text", required: true },
        { key: "tag_code", label: "Gown tag", kind: "text" },
        { key: "measurements", label: "Measurements", kind: "textarea" },
        { key: "seamstress_name", label: "Seamstress", kind: "text" },
        {
          key: "outsourced",
          label: "Outsourced",
          kind: "select",
          options: [
            { value: "false", label: "In-house" },
            { value: "true", label: "Outsourced" },
          ],
        },
        { key: "next_fitting_at", label: "Next fitting", kind: "datetime-local" },
        { key: "photo_url", label: "Progress photo URL", kind: "text", list: false },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BRIDAL_ALT_STATUSES, BRIDAL_ALT_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
