"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import {
  VENUE_POLICY_KIND_LABELS,
  VENUE_POLICY_KINDS,
} from "@/lib/venueService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function VenuePoliciesPage() {
  return (
    <VenueOpsPage
      title="Policies"
      description="Alcohol (in-house, BYO with licensed bartender, corkage), outside vendor rules, and COI requirements. Store the policy text — not a legal generator."
      kind="policies"
      wrap="rows"
      fields={[
        { key: "title", label: "Policy name", kind: "text", required: true },
        {
          key: "kind",
          label: "Kind",
          kind: "select",
          options: opts(VENUE_POLICY_KINDS, VENUE_POLICY_KIND_LABELS),
        },
        { key: "notes", label: "Policy text", kind: "textarea" },
      ]}
    />
  );
}
