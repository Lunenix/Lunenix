"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";
import {
  BRIDAL_ORDER_KIND_LABELS,
  BRIDAL_ORDER_KINDS,
  BRIDAL_ORDER_STATUS_LABELS,
  BRIDAL_ORDER_STATUSES,
} from "@/lib/bridalService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BridalOrdersPage() {
  return (
    <BridalOpsPage
      title="Orders"
      description="In-stock vs special order, designer ETA, deposit amount. Digital sale agreement is shared Contracts / e-sign. Payment plans are invoices (deposit + installments). Luna never collects cards."
      kind="orders"
      wrap="orders"
      fields={[
        { key: "title", label: "Order / client", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(BRIDAL_ORDER_KINDS, BRIDAL_ORDER_KIND_LABELS),
        },
        { key: "tag_code", label: "Gown tag", kind: "text" },
        { key: "designer", label: "Designer", kind: "text" },
        { key: "eta_on", label: "Expected arrival", kind: "date" },
        { key: "wedding_on", label: "Wedding date", kind: "date", list: false },
        {
          key: "deposit_paid",
          label: "Deposit paid",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        { key: "retainer_amount", label: "Deposit amount", kind: "number" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BRIDAL_ORDER_STATUSES, BRIDAL_ORDER_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
