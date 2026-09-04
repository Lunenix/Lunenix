"use client";

import { VenueOpsPage } from "@/components/venue/VenueOpsPage";

export default function VenueToursPage() {
  return (
    <VenueOpsPage
      title="Tours"
      description="Tour time, talking points, setup photos (URL), and client questions. Confirmation is email — two-way SMS is not live."
      kind="tours"
      wrap="rows"
      fields={[
        { key: "title", label: "Tour name", kind: "text", required: true },
        { key: "tour_at", label: "Tour time", kind: "datetime-local" },
        { key: "space_name", label: "Space", kind: "text" },
        { key: "talking_points", label: "Checklist / talking points", kind: "textarea" },
        { key: "client_questions", label: "Client questions", kind: "textarea", list: false },
        { key: "photo_url", label: "Setup photo URL", kind: "text", list: false },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
