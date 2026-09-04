"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import {
  CATERING_COMPLIANCE_KIND_LABELS,
  CATERING_COMPLIANCE_KINDS,
  CATERING_COMPLIANCE_STATUS_LABELS,
  CATERING_COMPLIANCE_STATUSES,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function CateringCompliancePage() {
  return (
    <CateringOpsPage
      title="Health & licenses"
      description="Food handler certs, kitchen health license, venue COI, and alcohol permits. Expiring items alert on Catering ops."
      kind="compliance"
      wrap="rows"
      fields={[
        { key: "title", label: "Item", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(CATERING_COMPLIANCE_KINDS, CATERING_COMPLIANCE_KIND_LABELS),
        },
        { key: "holder_name", label: "Holder / kitchen", kind: "text" },
        { key: "expires_on", label: "Expires", kind: "date" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(
            CATERING_COMPLIANCE_STATUSES,
            CATERING_COMPLIANCE_STATUS_LABELS
          ),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
