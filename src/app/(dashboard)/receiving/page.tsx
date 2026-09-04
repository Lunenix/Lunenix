"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";
import {
  BRIDAL_RECEIVE_STATUS_LABELS,
  BRIDAL_RECEIVE_STATUSES,
} from "@/lib/bridalService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function ReceivingPage() {
  return (
    <BridalOpsPage
      title="Receiving"
      description="Type the tag when a shipment arrives and assign rack / section / hanger. Then add or update Floor inventory. Scan is typed barcode text — not a hardware RFID dock. Return-to-designer is item status Returned."
      kind="receiving"
      wrap="rows"
      fields={[
        { key: "title", label: "Shipment / item", kind: "text", required: true },
        { key: "tag_code", label: "Tag / barcode", kind: "text" },
        { key: "rack", label: "Rack", kind: "text" },
        { key: "section", label: "Section", kind: "text" },
        { key: "hanger", label: "Hanger", kind: "text" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BRIDAL_RECEIVE_STATUSES, BRIDAL_RECEIVE_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
