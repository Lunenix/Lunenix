"use client";

import { CateringOpsPage } from "@/components/catering/CateringOpsPage";

export default function CateringStylePage() {
  return (
    <CateringOpsPage
      title="Presentation"
      description="Inspiration image URLs, colors/theme, garnish notes, must-haves. Not a live Pinterest board."
      kind="vision"
      wrap="rows"
      fields={[
        { key: "title", label: "Event / board", kind: "text", required: true },
        { key: "image_url", label: "Inspiration image URL", kind: "text" },
        { key: "theme_colors", label: "Colors / theme", kind: "text" },
        { key: "presentation_notes", label: "Presentation / garnish notes", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
