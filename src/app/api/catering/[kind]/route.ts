import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  CATERING_COMPLIANCE_KINDS,
  CATERING_COMPLIANCE_STATUSES,
  CATERING_CREW_ROLES,
  CATERING_EQUIP_KINDS,
  CATERING_EVENT_STATUSES,
  CATERING_EVENT_TYPES,
  CATERING_ONSITE_KINDS,
  CATERING_ORDER_STATUSES,
  CATERING_PREP_STATUSES,
  CATERING_STYLES,
  cateringEventDateFields,
  flattenCateringSpecs,
} from "@/lib/cateringService";

const KINDS = {
  events: { table: "catering_events", wrap: "events", required: ["title"] },
  menus: { table: "catering_menus", wrap: "rows", required: ["title"] },
  tastings: { table: "catering_tastings", wrap: "rows", required: ["title"] },
  vision: { table: "catering_vision", wrap: "rows", required: ["title"] },
  compliance: { table: "catering_compliance", wrap: "rows", required: ["title"] },
  orders: { table: "catering_orders", wrap: "rows", required: ["title"] },
  prep: { table: "catering_prep", wrap: "rows", required: ["title"] },
  crew: { table: "catering_crew", wrap: "crew", required: ["name"] },
  equipment: { table: "catering_equipment", wrap: "rows", required: ["title"] },
  onsite: { table: "catering_onsite", wrap: "rows", required: ["title"] },
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
    const dates = cateringEventDateFields(body);
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      title: str(body, "title") ?? "",
      event_on: dates.event_on,
      venue_name: str(body, "venue_name"),
      venue_address: str(body, "venue_address"),
      guest_count: num(body, "guest_count"),
      headcount_confirmed: bool(body, "headcount_confirmed"),
      event_type: inList(CATERING_EVENT_TYPES, body.event_type, "wedding"),
      lead_source: str(body, "lead_source"),
      budget_range: str(body, "budget_range"),
      dietary_notes: str(body, "dietary_notes"),
      vegan_count: num(body, "vegan_count"),
      gf_count: num(body, "gf_count"),
      nut_free_count: num(body, "nut_free_count"),
      service_style: inList(CATERING_STYLES, body.service_style, "buffet"),
      tasting_at: dates.tasting_at,
      load_in_at: dates.load_in_at,
      service_start_at: dates.service_start_at,
      service_end_at: dates.service_end_at,
      load_out_at: dates.load_out_at,
      staff_notes: str(body, "staff_notes"),
      equipment_checklist: str(body, "equipment_checklist"),
      route_notes: str(body, "route_notes"),
      deposit_paid: bool(body, "deposit_paid"),
      retainer_amount: num(body, "retainer_amount") ?? 0,
      package_price: num(body, "package_price"),
      food_cost: num(body, "food_cost"),
      labor_cost: num(body, "labor_cost"),
      rental_cost: num(body, "rental_cost"),
      must_haves: str(body, "must_haves"),
      avoid_items: str(body, "avoid_items"),
      status: inList(CATERING_EVENT_STATUSES, body.status, "inquiry"),
    };
  }
  if (kind === "menus") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      service_style: inList(CATERING_STYLES, body.service_style, "buffet"),
      courses: str(body, "courses"),
      tasting_notes: str(body, "tasting_notes"),
    };
  }
  if (kind === "tastings") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      tasting_at: str(body, "tasting_at"),
      feedback: str(body, "feedback"),
    };
  }
  if (kind === "vision") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      image_url: str(body, "image_url"),
      theme_colors: str(body, "theme_colors"),
      presentation_notes: str(body, "presentation_notes"),
    };
  }
  if (kind === "compliance") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      kind: inList(CATERING_COMPLIANCE_KINDS, body.kind, "food_handler"),
      holder_name: str(body, "holder_name"),
      expires_on: str(body, "expires_on"),
      status: inList(CATERING_COMPLIANCE_STATUSES, body.status, "pending"),
    };
  }
  if (kind === "orders") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      purveyor: str(body, "purveyor"),
      delivery_on: str(body, "delivery_on"),
      waste_notes: str(body, "waste_notes"),
      status: inList(CATERING_ORDER_STATUSES, body.status, "needed"),
    };
  }
  if (kind === "prep") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      due_at: str(body, "due_at"),
      station: str(body, "station"),
      assignee_name: str(body, "assignee_name"),
      checklist: str(body, "checklist"),
      equipment_needs: str(body, "equipment_needs"),
      status: inList(CATERING_PREP_STATUSES, body.status, "planned"),
    };
  }
  if (kind === "crew") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      role: inList(CATERING_CREW_ROLES, body.role, "chef"),
      cert: str(body, "cert"),
      rating: num(body, "rating"),
    };
  }
  if (kind === "equipment") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      kind: inList(CATERING_EQUIP_KINDS, body.kind, "kitchen"),
      qty: num(body, "qty"),
      reorder_below: num(body, "reorder_below"),
      condition_notes: str(body, "condition_notes"),
    };
  }
  return {
    ...base,
    title: str(body, "title") ?? "",
    kind: inList(CATERING_ONSITE_KINDS, body.kind, "presentation"),
    image_url: str(body, "image_url"),
    temp_f: num(body, "temp_f"),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown catering resource" }, { status: 404 });
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
    return NextResponse.json({ error: "Unknown catering resource" }, { status: 404 });
  }
  const raw = (await request.json()) as Record<string, unknown>;
  const body = kind === "events" ? flattenCateringSpecs(raw) : raw;
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
