"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";

export default function TastingsPage() {
  return (
    <CateringOpsPage
      title="Tastings"
      description="Tasting time and client feedback. Confirm on Schedule and text from Texts."
      kind="tastings"
      wrap="rows"
      fields={[
        { key: "title", label: "Client / tasting", kind: "text", required: true },
        { key: "tasting_at", label: "Tasting", kind: "datetime-local" },
        { key: "feedback", label: "Feedback", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
