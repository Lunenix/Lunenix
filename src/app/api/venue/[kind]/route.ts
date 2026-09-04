import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  VENUE_BOOKING_STATUSES,
  VENUE_COMPLIANCE_KINDS,
  VENUE_COMPLIANCE_STATUSES,
  VENUE_CREW_ROLES,
  VENUE_DAMAGE_STATUSES,
  VENUE_EVENT_TYPES,
  VENUE_LAYOUT_TYPES,
  VENUE_MAINT_KINDS,
  VENUE_MAINT_STATUSES,
  VENUE_ONSITE_KINDS,
  VENUE_POLICY_KINDS,
  VENUE_REVIEW_STATUSES,
  VENUE_TIERS,
  VENUE_TURNOVER_STATUSES,
  VENUE_VENDOR_CATEGORIES,
  flattenVenueSpecs,
  venueBookingDateFields,
} from "@/lib/venueService";

const KINDS = {
  spaces: { table: "venue_spaces", wrap: "spaces", required: ["name"] },
  bookings: { table: "venue_bookings", wrap: "events", required: ["title"] },
  tours: { table: "venue_tours", wrap: "rows", required: ["title"] },
  vendors: { table: "venue_vendors", wrap: "vendors", required: ["name"] },
  policies: { table: "venue_policies", wrap: "rows", required: ["title"] },
  compliance: { table: "venue_compliance", wrap: "rows", required: ["title"] },
  layouts: { table: "venue_layouts", wrap: "rows", required: ["title"] },
  crew: { table: "venue_crew", wrap: "crew", required: ["name"] },
  turnovers: { table: "venue_turnovers", wrap: "rows", required: ["title"] },
  maintenance: { table: "venue_maintenance", wrap: "rows", required: ["title"] },
  onsite: { table: "venue_onsite", wrap: "rows", required: ["title"] },
  deposits: { table: "venue_deposits", wrap: "rows", required: ["title"] },
} as const;

type Kind = keyof typeof KINDS;

function pickKind(raw: string): Kind | null {
  return raw in KINDS ? (raw as Kind) : null;
}

function inList(list: readonly string[], value: unknown, fallback: string) {
  return typeof value === "string" && list.includes(value) ? value : fallback;
}

function str(body: Record<string, unknown>, key: string) {
  const v = body[key];
  return typeof v === "string" ? v.trim() || null : null;
}

function num(body: Record<string, unknown>, key: string) {
  const v = body[key];
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(body: Record<string, unknown>, key: string, fallback = false) {
  const v = body[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number" && Number.isFinite(v)) return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "1", "paid"].includes(s)) return true;
    if (["false", "no", "0", ""].includes(s)) return false;
  }
  return fallback;
}

function payloadFor(
  kind: Kind,
  workspaceId: string,
  body: Record<string, unknown>
): Record<string, unknown> {
  const base = { workspace_id: workspaceId, notes: str(body, "notes") };
  if (kind === "spaces") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      capacity_banquet: num(body, "capacity_banquet"),
      capacity_theater: num(body, "capacity_theater"),
      capacity_cocktail: num(body, "capacity_cocktail"),
    };
  }
  if (kind === "bookings") {
    const dates = venueBookingDateFields(body);
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      project_id: str(body, "project_id"),
      title: str(body, "title") ?? "",
      space_name: str(body, "space_name"),
      event_on: dates.event_on,
      event_type: inList(VENUE_EVENT_TYPES, body.event_type, "wedding"),
      lead_source: str(body, "lead_source"),
      guest_count: num(body, "guest_count"),
      rental_tier: inList(VENUE_TIERS, body.rental_tier, "ceremony_reception"),
      included_items: str(body, "included_items"),
      addons: str(body, "addons"),
      hours: num(body, "hours"),
      overtime_rate: num(body, "overtime_rate"),
      tour_at: dates.tour_at,
      load_in_at: dates.load_in_at,
      event_start_at: dates.event_start_at,
      event_end_at: dates.event_end_at,
      load_out_at: dates.load_out_at,
      access_notes: str(body, "access_notes"),
      staff_notes: str(body, "staff_notes"),
      vendor_windows: str(body, "vendor_windows"),
      deposit_paid: bool(body, "deposit_paid"),
      retainer_amount: num(body, "retainer_amount") ?? 0,
      damage_deposit_amount: num(body, "damage_deposit_amount") ?? 0,
      damage_deposit_status: inList(
        VENUE_DAMAGE_STATUSES,
        body.damage_deposit_status,
        "none"
      ),
      date_held: bool(body, "date_held"),
      status: inList(VENUE_BOOKING_STATUSES, body.status, "inquiry"),
    };
  }
  if (kind === "tours") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      tour_at: str(body, "tour_at"),
      space_name: str(body, "space_name"),
      talking_points: str(body, "talking_points"),
      client_questions: str(body, "client_questions"),
      photo_url: str(body, "photo_url"),
    };
  }
  if (kind === "vendors") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      category: inList(VENUE_VENDOR_CATEGORIES, body.category, "other"),
      preferred: bool(body, "preferred", true),
      required_inhouse: bool(body, "required_inhouse"),
      coi_expires_on: str(body, "coi_expires_on"),
    };
  }
  if (kind === "policies") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      kind: inList(VENUE_POLICY_KINDS, body.kind, "other"),
    };
  }
  if (kind === "compliance") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      kind: inList(VENUE_COMPLIANCE_KINDS, body.kind, "client_insurance"),
      expires_on: str(body, "expires_on"),
      status: inList(VENUE_COMPLIANCE_STATUSES, body.status, "pending"),
    };
  }
  if (kind === "layouts") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      space_name: str(body, "space_name"),
      layout_type: inList(VENUE_LAYOUT_TYPES, body.layout_type, "banquet"),
      capacity: num(body, "capacity"),
      photo_url: str(body, "photo_url"),
      client_status: inList(
        VENUE_REVIEW_STATUSES,
        body.client_status,
        "pending"
      ),
    };
  }
  if (kind === "crew") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      role: inList(VENUE_CREW_ROLES, body.role, "coordinator"),
      cert: str(body, "cert"),
      rating: num(body, "rating"),
    };
  }
  if (kind === "turnovers") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      from_event: str(body, "from_event"),
      to_event: str(body, "to_event"),
      buffer_hours: num(body, "buffer_hours"),
      status: inList(VENUE_TURNOVER_STATUSES, body.status, "scheduled"),
      condition_notes: str(body, "condition_notes"),
    };
  }
  if (kind === "maintenance") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      kind: inList(VENUE_MAINT_KINDS, body.kind, "facility"),
      status: inList(VENUE_MAINT_STATUSES, body.status, "ok"),
      next_service_on: str(body, "next_service_on"),
    };
  }
  if (kind === "deposits") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      amount: num(body, "amount") ?? 0,
      status: inList(VENUE_DAMAGE_STATUSES, body.status, "held"),
      assessment_notes: str(body, "assessment_notes"),
    };
  }
  return {
    ...base,
    title: str(body, "title") ?? "",
    kind: inList(VENUE_ONSITE_KINDS, body.kind, "before_photo"),
    image_url: str(body, "image_url"),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown venue resource" }, { status: 404 });
  }
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const spec = KINDS[kind];
  const { data, error } = await auth.supabase
    .from(spec.table)
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ [spec.wrap]: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown venue resource" }, { status: 404 });
  }
  const raw = (await request.json()) as Record<string, unknown>;
  const body = kind === "bookings" ? flattenVenueSpecs(raw) : raw;
  const auth = await requireWorkspaceMember(String(body.workspace_id ?? ""));
  if ("error" in auth) return auth.error;
  const spec = KINDS[kind];
  const payload = payloadFor(kind, auth.workspaceId, body);
  for (const key of spec.required) {
    if (!payload[key]) {
      return NextResponse.json({ error: `${key} is required` }, { status: 400 });
    }
  }
  const { data, error } = await auth.supabase
    .from(spec.table)
    .insert(payload)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data }, { status: 201 });
}
