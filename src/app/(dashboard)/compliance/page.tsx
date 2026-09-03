"use client";

import { BarOpsPage } from "@/components/bar/BarOpsPage";
import {
  BAR_COMPLIANCE_KIND_LABELS,
  BAR_COMPLIANCE_KINDS,
  BAR_COMPLIANCE_STATUS_LABELS,
  BAR_COMPLIANCE_STATUSES,
} from "@/lib/barService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BarCompliancePage() {
  return (
    <BarOpsPage
      title="Licensing & insurance"
      description="Liquor licenses, single-event permits, liability COIs, venue riders, and TIPS certs per bartender. Expiring items also show on Bar ops."
      kind="compliance"
      wrap="rows"
      fields={[
        { key: "name", label: "Name / number label", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(BAR_COMPLIANCE_KINDS, BAR_COMPLIANCE_KIND_LABELS),
        },
        { key: "holder_name", label: "Holder / bartender", kind: "text" },
        { key: "expires_on", label: "Expires", kind: "date" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BAR_COMPLIANCE_STATUSES, BAR_COMPLIANCE_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
