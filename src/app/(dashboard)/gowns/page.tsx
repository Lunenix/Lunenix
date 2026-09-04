"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";
import {
  BRIDAL_ITEM_KIND_LABELS,
  BRIDAL_ITEM_KINDS,
  BRIDAL_ITEM_STATUS_LABELS,
  BRIDAL_ITEM_STATUSES,
} from "@/lib/bridalService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function GownsPage() {
  return (
    <BridalOpsPage
      title="Floor inventory"
      description="Each garment has a tag code (QR/barcode text — not live RFID), style, size, designer, price, and rack / section / hanger. Status: showroom, fitting room, hold, alterations, sold, in transit. Search the table for instant location. Set reorder-below for low-stock alerts."
      kind="items"
      wrap="items"
      fields={[
        { key: "title", label: "Item name", kind: "text", required: true },
        { key: "tag_code", label: "Tag / QR / barcode", kind: "text" },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(BRIDAL_ITEM_KINDS, BRIDAL_ITEM_KIND_LABELS),
        },
        { key: "style_name", label: "Style", kind: "text" },
        { key: "size", label: "Size", kind: "text" },
        { key: "color", label: "Color", kind: "text", list: false },
        { key: "designer", label: "Designer", kind: "text" },
        { key: "price", label: "Price", kind: "number" },
        { key: "cost", label: "Cost", kind: "number", list: false },
        { key: "qty", label: "Qty", kind: "number" },
        { key: "reorder_below", label: "Reorder below", kind: "number", list: false },
        { key: "rack", label: "Rack", kind: "text" },
        { key: "section", label: "Section", kind: "text" },
        { key: "hanger", label: "Hanger", kind: "text" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BRIDAL_ITEM_STATUSES, BRIDAL_ITEM_STATUS_LABELS),
        },
        {
          key: "sample_sale",
          label: "Sample / clearance",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
          list: false,
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
