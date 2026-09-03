import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  PLANNER_BUDGET_CATEGORIES,
  PLANNER_CREW_ROLES,
  PLANNER_EVENT_STATUSES,
  PLANNER_EVENT_TYPES,
  PLANNER_ONSITE_KINDS,
  PLANNER_RENTAL_STATUSES,
  PLANNER_REVIEW_STATUSES,
  PLANNER_RSVP,
  PLANNER_SEGMENTS,
  PLANNER_TIERS,
  PLANNER_VENDOR_CATEGORIES,
  PLANNER_VENDOR_STATUSES,
  PLANNER_VISION_KINDS,
  flattenPlannerSpecs,
  plannerEventDateFields,
} from "@/lib/plannerService";

const KINDS = {
  events: { table: "planner_events", wrap: "events", required: ["title"] },
  vision: { table: "planner_vision", wrap: "rows", required: ["title"] },
  layouts: { table: "planner_layouts", wrap: "rows", required: ["title"] },
  budget: { table: "planner_budget_lines", wrap: "rows", required: ["label"] },
  vendors: { table: "planner_vendors", wrap: "vendors", required: ["name"] },
  guests: { table: "planner_guests", wrap: "guests", required: ["name"] },
  timeline: { table: "planner_timeline", wrap: "rows", required: ["title"] },
  crew: { table: "planner_crew", wrap: "crew", required: ["name"] },
  rentals: { table: "planner_rentals", wrap: "rentals", required: ["item_name"] },
  onsite: { table: "planner_onsite", wrap: "rows", required: ["title"] },
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
  if (kind === "events") {
    const dates = plannerEventDateFields(body);
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      project_id: str(body, "project_id"),
      title: str(body, "title") ?? "",
      event_on: dates.event_on,
      venue_name: str(body, "venue_name"),
      venue_address: str(body, "venue_address"),
      guest_count: num(body, "guest_count"),
      event_type: inList(PLANNER_EVENT_TYPES, body.event_type, "wedding"),
      lead_source: str(body, "lead_source"),
      planning_tier: inList(PLANNER_TIERS, body.planning_tier, "full"),
      addons: str(body, "addons"),
      budget_range: str(body, "budget_range"),
      budget_total: num(body, "budget_total"),
      deposit_paid: bool(body, "deposit_paid"),
      retainer_amount: num(body, "retainer_amount") ?? 0,
      consult_at: dates.consult_at,
      theme_colors: str(body, "theme_colors"),
      must_haves: str(body, "must_haves"),
      avoid_items: str(body, "avoid_items"),
      status: inList(PLANNER_EVENT_STATUSES, body.status, "inquiry"),
    };
  }
  if (kind === "vision") {
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      title: str(body, "title") ?? "",
      kind: inList(PLANNER_VISION_KINDS, body.kind, "wish"),
      image_url: str(body, "image_url"),
      client_status: inList(PLANNER_REVIEW_STATUSES, body.client_status, "pending"),
    };
  }
  if (kind === "layouts") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      venue_photo_url: str(body, "venue_photo_url"),
      layout_notes: str(body, "layout_notes"),
      seating_notes: str(body, "seating_notes"),
    };
  }
  if (kind === "budget") {
    return {
      ...base,
      category: inList(PLANNER_BUDGET_CATEGORIES, body.category, "other"),
      label: str(body, "label") ?? "",
      planned_amount: num(body, "planned_amount") ?? 0,
      actual_amount: num(body, "actual_amount") ?? 0,
    };
  }
  if (kind === "vendors") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      category: inList(PLANNER_VENDOR_CATEGORIES, body.category, "other"),
      status: inList(PLANNER_VENDOR_STATUSES, body.status, "sourcing"),
      coi_expires_on: str(body, "coi_expires_on"),
      payment_notes: str(body, "payment_notes"),
    };
  }
  if (kind === "guests") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      rsvp: inList(PLANNER_RSVP, body.rsvp, "pending"),
      meal: str(body, "meal"),
      dietary: str(body, "dietary"),
      table_name: str(body, "table_name"),
    };
  }
  if (kind === "timeline") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      segment: inList(PLANNER_SEGMENTS, body.segment, "setup"),
      starts_at: str(body, "starts_at"),
      ends_at: str(body, "ends_at"),
      assignee_name: str(body, "assignee_name"),
      vendor_name: str(body, "vendor_name"),
    };
  }
  if (kind === "crew") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      role: inList(PLANNER_CREW_ROLES, body.role, "lead"),
      rating: num(body, "rating"),
    };
  }
  if (kind === "rentals") {
    return {
      ...base,
      item_name: str(body, "item_name") ?? "",
      vendor_name: str(body, "vendor_name"),
      status: inList(PLANNER_RENTAL_STATUSES, body.status, "needed"),
      delivery_on: str(body, "delivery_on"),
      pickup_on: str(body, "pickup_on"),
      owned: bool(body, "owned"),
    };
  }
  return {
    ...base,
    title: str(body, "title") ?? "",
    kind: inList(PLANNER_ONSITE_KINDS, body.kind, "setup_photo"),
    image_url: str(body, "image_url"),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown planner resource" }, { status: 404 });
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
    return NextResponse.json({ error: "Unknown planner resource" }, { status: 404 });
  }
  const raw = (await request.json()) as Record<string, unknown>;
  const body = kind === "events" ? flattenPlannerSpecs(raw) : raw;
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
