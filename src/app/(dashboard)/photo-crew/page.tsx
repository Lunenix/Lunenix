"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";

export default function PhotoCrewPage() {
  return (
    <PhotoOpsPage
      title="Crew"
      description="Second shooters, videographers, and assistants. Not a live roster."
      kind="crew"
      wrap="crew"
      fields={[
        { key: "name", label: "Name", kind: "text", required: true },
        { key: "role", label: "Role", kind: "text" },
        { key: "rating", label: "Rating", kind: "number" },
        { key: "notes", label: "Availability / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
