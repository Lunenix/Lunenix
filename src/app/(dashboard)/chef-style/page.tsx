"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";

export default function ChefStylePage() {
  return (
    <ChefOpsPage
      title="Inspiration"
      description="Special-occasion dish photos and presentation notes. Image URLs — not a live Pinterest board."
      kind="vision"
      wrap="rows"
      fields={[
        { key: "title", label: "Occasion / board", kind: "text", required: true },
        { key: "image_url", label: "Inspiration image URL", kind: "text" },
        { key: "presentation_notes", label: "Presentation notes", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
