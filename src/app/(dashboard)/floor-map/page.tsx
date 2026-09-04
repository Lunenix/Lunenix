"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";

export default function FloorMapPage() {
  return (
    <BridalOpsPage
      title="Floor map"
      description="Named showroom spots (Rack 4, Section B) plus an optional floor-plan photo URL. This is a labeled map, not a live 3D model. Item locations live on Floor inventory."
      kind="locations"
      wrap="rows"
      fields={[
        { key: "name", label: "Spot name (e.g. Rack 4)", kind: "text", required: true },
        { key: "zone", label: "Zone / section", kind: "text" },
        { key: "map_url", label: "Floor-plan photo URL", kind: "text" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
