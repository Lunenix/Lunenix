"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_COVERAGE,
  PHOTO_COVERAGE_LABELS,
} from "@/lib/photoService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function PhotoPackagesPage() {
  return (
    <PhotoOpsPage
      title="Packages"
      description="Hours, shooters, photo vs video, deliverables, and add-ons (drone, engagement, album, rush). Quotes still go out on Estimates. This is not auto-billing."
      kind="packages"
      wrap="rows"
      fields={[
        { key: "title", label: "Package", kind: "text", required: true },
        { key: "hours", label: "Hours", kind: "number" },
        { key: "shooters", label: "Shooters", kind: "number" },
        {
          key: "coverage",
          label: "Coverage",
          kind: "select",
          options: opts(PHOTO_COVERAGE, PHOTO_COVERAGE_LABELS),
        },
        { key: "deliverables", label: "Deliverables", kind: "textarea" },
        { key: "add_ons", label: "Add-ons", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
