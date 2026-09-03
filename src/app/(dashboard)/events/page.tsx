"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { BarOpsPage } from "@/components/bar/BarOpsPage";
import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import { isEventPlannerWorkspace } from "@/lib/plannerService";
import {
  BAR_CONSULT_KIND_LABELS,
  BAR_CONSULT_KINDS,
  BAR_EVENT_STATUS_LABELS,
  BAR_EVENT_STATUSES,
  BAR_EVENT_TYPE_LABELS,
  BAR_EVENT_TYPES,
  BAR_PACKAGE_TIER_LABELS,
  BAR_PACKAGE_TIERS,
} from "@/lib/barService";
import {
  PLANNER_EVENT_STATUS_LABELS,
  PLANNER_EVENT_STATUSES,
  PLANNER_EVENT_TYPE_LABELS,
  PLANNER_EVENT_TYPES,
  PLANNER_TIER_LABELS,
  PLANNER_TIERS,
} from "@/lib/plannerService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

function PlannerEvents() {
  return (
    <PlannerOpsPage
      title="Events"
      description="Consultations and booked events: date, venue, guests, planning tier, budget range, retainer. Amounts only — Luna never collects cards. Two-way SMS is not live — use email."
      kind="events"
      wrap="events"
      fields={[
        { key: "title", label: "Event name", kind: "text", required: true },
        { key: "event_on", label: "Event date", kind: "date" },
        { key: "venue_name", label: "Venue", kind: "text" },
        { key: "venue_address", label: "Venue address", kind: "text", list: false },
        { key: "guest_count", label: "Guest count", kind: "number" },
        {
          key: "event_type",
          label: "Event type",
          kind: "select",
          options: opts(PLANNER_EVENT_TYPES, PLANNER_EVENT_TYPE_LABELS),
        },
        { key: "lead_source", label: "Lead source", kind: "text", list: false },
        {
          key: "planning_tier",
          label: "Planning package",
          kind: "select",
          options: opts(PLANNER_TIERS, PLANNER_TIER_LABELS),
        },
        { key: "addons", label: "Add-ons (design, vendors, RSVP)", kind: "text", list: false },
        { key: "budget_range", label: "Budget range", kind: "text", list: false },
        { key: "budget_total", label: "Budget total", kind: "number", list: false },
        {
          key: "deposit_paid",
          label: "Deposit paid",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        { key: "retainer_amount", label: "Retainer amount", kind: "number" },
        { key: "consult_at", label: "Consult", kind: "datetime-local", list: false },
        { key: "theme_colors", label: "Colors / theme", kind: "text", list: false },
        { key: "must_haves", label: "Must-haves", kind: "textarea", list: false },
        { key: "avoid_items", label: "Avoid", kind: "textarea", list: false },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PLANNER_EVENT_STATUSES, PLANNER_EVENT_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}

function BarEvents() {
  return (
    <BarOpsPage
      title="Events"
      description="Consultations and booked events: date, venue, guests, retainer, deposit paid, package, load-in, and venue access. Amounts only — Luna never collects cards. Two-way SMS is not live — use email."
      kind="events"
      wrap="events"
      fields={[
        { key: "title", label: "Event name", kind: "text", required: true },
        { key: "event_on", label: "Event date", kind: "date" },
        { key: "venue_name", label: "Venue", kind: "text" },
        { key: "venue_address", label: "Venue address", kind: "text", list: false },
        { key: "guest_count", label: "Guest count", kind: "number" },
        {
          key: "deposit_paid",
          label: "Deposit paid",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        { key: "retainer_amount", label: "Retainer amount", kind: "number" },
        {
          key: "event_type",
          label: "Event type",
          kind: "select",
          options: opts(BAR_EVENT_TYPES, BAR_EVENT_TYPE_LABELS),
        },
        { key: "lead_source", label: "Lead source", kind: "text", list: false },
        {
          key: "package_tier",
          label: "Package",
          kind: "select",
          options: opts(BAR_PACKAGE_TIERS, BAR_PACKAGE_TIER_LABELS),
        },
        {
          key: "consult_kind",
          label: "Consult type",
          kind: "select",
          options: opts(BAR_CONSULT_KINDS, BAR_CONSULT_KIND_LABELS),
          list: false,
        },
        { key: "hours", label: "Hours", kind: "number", list: false },
        { key: "addons", label: "Add-ons (glassware, garnish, ice)", kind: "text", list: false },
        { key: "load_in_at", label: "Load-in", kind: "datetime-local", list: false },
        { key: "event_start_at", label: "Event start", kind: "datetime-local", list: false },
        { key: "event_end_at", label: "Event end", kind: "datetime-local", list: false },
        { key: "breakdown_at", label: "Breakdown", kind: "datetime-local", list: false },
        { key: "staff_notes", label: "Staff assignment", kind: "textarea", list: false },
        {
          key: "equipment_checklist",
          label: "Equipment packed",
          kind: "textarea",
          list: false,
        },
        { key: "venue_access", label: "Venue access (dock, power, water)", kind: "textarea", list: false },
        { key: "theme_colors", label: "Wedding / event colors", kind: "text", list: false },
        { key: "must_haves", label: "Must-haves", kind: "textarea", list: false },
        { key: "avoid_items", label: "Avoid", kind: "textarea", list: false },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(BAR_EVENT_STATUSES, BAR_EVENT_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}

export default function EventsPage() {
  const { activeWorkspace } = useWorkspace();
  if (isEventPlannerWorkspace(activeWorkspace?.industry_preset)) {
    return <PlannerEvents />;
  }
  return <BarEvents />;
}
