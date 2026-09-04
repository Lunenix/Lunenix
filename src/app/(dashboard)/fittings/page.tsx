"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";

export default function FittingsPage() {
  return (
    <BridalOpsPage
      title="Fittings"
      description="Gowns pulled (tag codes), try-on photo URL with consent, favorites across visits, loved/disliked, sizing. Mark those tags In fitting room on Floor inventory — status does not auto-update."
      kind="fittings"
      wrap="rows"
      fields={[
        { key: "title", label: "Client / visit", kind: "text", required: true },
        { key: "starts_at", label: "Session", kind: "datetime-local" },
        { key: "pulled_tags", label: "Pulled tag codes", kind: "textarea" },
        { key: "photo_url", label: "Try-on photo URL", kind: "text" },
        { key: "favorites", label: "Shortlist / favorites", kind: "textarea" },
        { key: "loved", label: "Loved", kind: "textarea", list: false },
        { key: "disliked", label: "Disliked", kind: "textarea", list: false },
        { key: "sizing_notes", label: "Sizing notes", kind: "textarea", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
