"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";
import {
  BRIDAL_APPT_STATUS_LABELS,
  BRIDAL_APPT_STATUSES,
} from "@/lib/bridalService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function BridalAppointmentsPage() {
  return (
    <BridalOpsPage
      title="Appointments"
      description="Fitting or browse times, wedding date, party size, budget, and style prefs. Confirmation is email — two-way SMS is not live."
      kind="appointments"
      wrap="rows"
      fields={[
        { key: "title", label: "Bride / appointment", kind: "text", required: true },
        { key: "starts_at", label: "Appointment", kind: "datetime-local" },
        { key: "wedding_on", label: "Wedding date", kind: "date" },
        { key: "party_size", label: "Party size", kind: "number" },
        { key: "budget_range", label: "Budget range", kind: "text" },
        { key: "style_prefs", label: "Style preferences", kind: "textarea", list: false },
        { key: "venue_type", label: "Venue type", kind: "text", list: false },
        { key: "season", label: "Season", kind: "text", list: false },
        { key: "theme_colors", label: "Colors / theme", kind: "text", list: false },
        { key: "lead_source", label: "Lead source", kind: "text", list: false },
        { key: "stylist_name", label: "Stylist", kind: "text" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BRIDAL_APPT_STATUSES, BRIDAL_APPT_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
