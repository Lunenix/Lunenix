"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { BarOpsPage } from "@/components/bar/BarOpsPage";
import { PlannerOpsPage } from "@/components/planner/PlannerOpsPage";
import { VenueOpsPage } from "@/components/venue/VenueOpsPage";
import { CateringOpsPage } from "@/components/catering/CateringOpsPage";
import { isEventPlannerWorkspace } from "@/lib/plannerService";
import { isEventVenueWorkspace } from "@/lib/venueService";
import { isCatererWorkspace } from "@/lib/cateringService";
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
import {
  VENUE_BOOKING_STATUS_LABELS,
  VENUE_BOOKING_STATUSES,
  VENUE_DAMAGE_STATUS_LABELS,
  VENUE_DAMAGE_STATUSES,
  VENUE_EVENT_TYPE_LABELS,
  VENUE_EVENT_TYPES,
  VENUE_TIER_LABELS,
  VENUE_TIERS,
} from "@/lib/venueService";
import {
  CATERING_EVENT_STATUS_LABELS,
  CATERING_EVENT_STATUSES,
  CATERING_EVENT_TYPE_LABELS,
  CATERING_EVENT_TYPES,
  CATERING_STYLE_LABELS,
  CATERING_STYLES,
} from "@/lib/cateringService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

function CateringEvents() {
  return (
    <CateringOpsPage
      title="Events"
      description="Consultations, tastings, and booked service: date, venue, guests, dietary counts, service style, load-in/out, staffing, food cost vs package price. Final headcount is a flag — confirm it before the event. Two-way SMS is not live. Luna never collects cards."
      kind="events"
      wrap="events"
      fields={[
        { key: "title", label: "Event name", kind: "text", required: true },
        { key: "event_on", label: "Event date", kind: "date" },
        { key: "venue_name", label: "Venue", kind: "text" },
        { key: "venue_address", label: "Venue address", kind: "text", list: false },
        { key: "guest_count", label: "Guest count", kind: "number" },
        {
          key: "headcount_confirmed",
          label: "Final headcount confirmed",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        {
          key: "event_type",
          label: "Event type",
          kind: "select",
          options: opts(CATERING_EVENT_TYPES, CATERING_EVENT_TYPE_LABELS),
        },
        { key: "lead_source", label: "Lead source", kind: "text", list: false },
        { key: "budget_range", label: "Budget range", kind: "text", list: false },
        {
          key: "service_style",
          label: "Service style",
          kind: "select",
          options: opts(CATERING_STYLES, CATERING_STYLE_LABELS),
        },
        { key: "dietary_notes", label: "Dietary notes", kind: "textarea", list: false },
        { key: "vegan_count", label: "Vegan count", kind: "number", list: false },
        { key: "gf_count", label: "Gluten-free count", kind: "number", list: false },
        { key: "nut_free_count", label: "Nut-free count", kind: "number", list: false },
        { key: "tasting_at", label: "Tasting", kind: "datetime-local", list: false },
        { key: "load_in_at", label: "Load-in", kind: "datetime-local", list: false },
        { key: "service_start_at", label: "Service start", kind: "datetime-local", list: false },
        { key: "service_end_at", label: "Service end", kind: "datetime-local", list: false },
        { key: "load_out_at", label: "Load-out", kind: "datetime-local", list: false },
        { key: "staff_notes", label: "Staff assignment", kind: "textarea", list: false },
        { key: "equipment_checklist", label: "Equipment packed", kind: "textarea", list: false },
        { key: "route_notes", label: "Route / holding temps", kind: "textarea", list: false },
        {
          key: "deposit_paid",
          label: "Deposit paid",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        { key: "retainer_amount", label: "Deposit amount", kind: "number" },
        { key: "package_price", label: "Package price", kind: "number", list: false },
        { key: "food_cost", label: "Food cost", kind: "number", list: false },
        { key: "labor_cost", label: "Labor cost", kind: "number", list: false },
        { key: "rental_cost", label: "Rental cost", kind: "number", list: false },
        { key: "must_haves", label: "Must-haves", kind: "textarea", list: false },
        { key: "avoid_items", label: "Avoid", kind: "textarea", list: false },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(CATERING_EVENT_STATUSES, CATERING_EVENT_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}

function VenueEvents() {
  return (
    <VenueOpsPage
      title="Events"
      description="Tours, date holds, and booked rentals: space, guests, package, hours/overtime, load-in/out, access notes, rental deposit, and damage deposit. Availability is this list by date and space — not a live calendar widget. Hold the date when the contract is signed (does not auto-block on e-sign). Two-way SMS is not live. Luna never collects cards."
      kind="bookings"
      wrap="events"
      fields={[
        { key: "title", label: "Event name", kind: "text", required: true },
        { key: "event_on", label: "Event date", kind: "date" },
        { key: "space_name", label: "Space / room", kind: "text" },
        { key: "guest_count", label: "Guest count", kind: "number" },
        {
          key: "event_type",
          label: "Event type",
          kind: "select",
          options: opts(VENUE_EVENT_TYPES, VENUE_EVENT_TYPE_LABELS),
        },
        { key: "lead_source", label: "Lead source", kind: "text", list: false },
        {
          key: "rental_tier",
          label: "Rental package",
          kind: "select",
          options: opts(VENUE_TIERS, VENUE_TIER_LABELS),
        },
        { key: "included_items", label: "Included (tables, chairs, AV)", kind: "text", list: false },
        { key: "addons", label: "Add-ons (linens, staffing)", kind: "text", list: false },
        { key: "hours", label: "Rental hours", kind: "number", list: false },
        { key: "overtime_rate", label: "Overtime rate", kind: "number", list: false },
        { key: "tour_at", label: "Tour", kind: "datetime-local", list: false },
        { key: "load_in_at", label: "Load-in", kind: "datetime-local", list: false },
        { key: "event_start_at", label: "Event start", kind: "datetime-local", list: false },
        { key: "event_end_at", label: "Event end", kind: "datetime-local", list: false },
        { key: "load_out_at", label: "Load-out", kind: "datetime-local", list: false },
        { key: "vendor_windows", label: "Vendor arrival windows", kind: "textarea", list: false },
        { key: "access_notes", label: "Access (dock, parking, elevator, power)", kind: "textarea", list: false },
        { key: "staff_notes", label: "Staff assignment", kind: "textarea", list: false },
        {
          key: "deposit_paid",
          label: "Rental deposit paid",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        { key: "retainer_amount", label: "Rental deposit amount", kind: "number" },
        { key: "damage_deposit_amount", label: "Damage deposit amount", kind: "number", list: false },
        {
          key: "damage_deposit_status",
          label: "Damage deposit",
          kind: "select",
          options: opts(VENUE_DAMAGE_STATUSES, VENUE_DAMAGE_STATUS_LABELS),
          list: false,
        },
        {
          key: "date_held",
          label: "Date held on calendar",
          kind: "select",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(VENUE_BOOKING_STATUSES, VENUE_BOOKING_STATUS_LABELS),
        },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
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
  if (isCatererWorkspace(activeWorkspace?.industry_preset)) {
    return <CateringEvents />;
  }
  if (isEventVenueWorkspace(activeWorkspace?.industry_preset)) {
    return <VenueEvents />;
  }
  if (isEventPlannerWorkspace(activeWorkspace?.industry_preset)) {
    return <PlannerEvents />;
  }
  return <BarEvents />;
}
