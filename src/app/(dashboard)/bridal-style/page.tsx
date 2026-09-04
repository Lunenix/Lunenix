"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";

export default function BridalStylePage() {
  return (
    <BridalOpsPage
      title="Style matching"
      description="Inspiration image URLs, silhouette, neckline, fabric, and stylist match notes against in-stock gowns. This is not Pinterest or AR try-on."
      kind="vision"
      wrap="rows"
      fields={[
        { key: "title", label: "Client / board", kind: "text", required: true },
        { key: "image_url", label: "Inspiration image URL", kind: "text" },
        { key: "silhouette", label: "Silhouette", kind: "text" },
        { key: "neckline", label: "Neckline", kind: "text" },
        { key: "fabric", label: "Fabric", kind: "text" },
        { key: "match_notes", label: "In-stock match notes", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
