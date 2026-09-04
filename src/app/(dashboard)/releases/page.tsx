"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";

export default function PhotoReleasesPage() {
  return (
    <PhotoOpsPage
      title="Releases"
      description="Model/property release and usage notes. Store signed-on dates here; e-sign still uses Contracts."
      kind="releases"
      wrap="rows"
      fields={[
        { key: "title", label: "Subject / job", kind: "text", required: true },
        { key: "usage_notes", label: "Usage rights", kind: "textarea" },
        { key: "signed_on", label: "Signed on", kind: "date" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
