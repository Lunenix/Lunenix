import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  BAR_COMPLIANCE_KINDS,
  BAR_COMPLIANCE_STATUSES,
  BAR_CONSULT_KINDS,
  BAR_CREW_ROLES,
  BAR_EVENT_STATUSES,
  BAR_EVENT_TYPES,
  BAR_INCIDENT_KINDS,
  BAR_LOOK_KINDS,
  BAR_LOOK_STATUSES,
  BAR_MENU_STATUSES,
  BAR_ONSITE_KINDS,
  BAR_ORDER_KINDS,
  BAR_ORDER_STATUSES,
  BAR_PACKAGE_TIERS,
  BAR_SETUP_STYLES,
} from "@/lib/barService";

const KINDS = {
  events: { table: "bar_events", wrap: "events", required: ["title"] },
  menus: { table: "bar_menus", wrap: "menus", required: ["name"] },
  looks: { table: "bar_looks", wrap: "looks", required: ["title"] },
  compliance: { table: "bar_compliance", wrap: "rows", required: ["name"] },
  orders: { table: "bar_supply_orders", wrap: "orders", required: ["vendor_name"] },
  crew: { table: "bar_crew", wrap: "crew", required: ["name"] },
  onsite: { table: "bar_onsite", wrap: "rows", required: ["title"] },
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

function payloadFor(
  kind: Kind,
  workspaceId: string,
  body: Record<string, unknown>
): Record<string, unknown> {
  const base = { workspace_id: workspaceId, notes: str(body, "notes") };
  if (kind === "events") {
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      project_id: str(body, "project_id"),
      title: str(body, "title") ?? "",
      event_on: str(body, "event_on"),
      venue_name: str(body, "venue_name"),
      venue_address: str(body, "venue_address"),
      guest_count: num(body, "guest_count"),
      event_type: inList(BAR_EVENT_TYPES, body.event_type, "private_party"),
      lead_source: str(body, "lead_source"),
      package_tier: inList(BAR_PACKAGE_TIERS, body.package_tier, "full_open"),
      consult_at: str(body, "consult_at"),
      consult_kind: inList(BAR_CONSULT_KINDS, body.consult_kind, "call"),
      hours: num(body, "hours"),
      addons: str(body, "addons"),
      load_in_at: str(body, "load_in_at"),
      event_start_at: str(body, "event_start_at"),
      event_end_at: str(body, "event_end_at"),
      breakdown_at: str(body, "breakdown_at"),
      staff_notes: str(body, "staff_notes"),
      equipment_checklist: str(body, "equipment_checklist"),
      venue_access: str(body, "venue_access"),
      theme_colors: str(body, "theme_colors"),
      must_haves: str(body, "must_haves"),
      avoid_items: str(body, "avoid_items"),
      status: inList(BAR_EVENT_STATUSES, body.status, "inquiry"),
    };
  }
  if (kind === "menus") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      package_tier: inList(BAR_PACKAGE_TIERS, body.package_tier, "full_open"),
      setup_style: inList(BAR_SETUP_STYLES, body.setup_style, "cart"),
      cocktails: str(body, "cocktails"),
      mocktails: str(body, "mocktails"),
      dietary_notes: str(body, "dietary_notes"),
      garnish_notes: str(body, "garnish_notes"),
      status: inList(BAR_MENU_STATUSES, body.status, "draft"),
    };
  }
  if (kind === "looks") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      kind: inList(BAR_LOOK_KINDS, body.kind, "mockup"),
      image_url: str(body, "image_url"),
      venue_photo_url: str(body, "venue_photo_url"),
      client_status: inList(BAR_LOOK_STATUSES, body.client_status, "pending"),
    };
  }
  if (kind === "compliance") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      kind: inList(BAR_COMPLIANCE_KINDS, body.kind, "liquor_license"),
      holder_name: str(body, "holder_name"),
      expires_on: str(body, "expires_on"),
      status: inList(BAR_COMPLIANCE_STATUSES, body.status, "needed"),
    };
  }
  if (kind === "orders") {
    return {
      ...base,
      vendor_name: str(body, "vendor_name") ?? "",
      kind: inList(BAR_ORDER_KINDS, body.kind, "alcohol"),
      status: inList(BAR_ORDER_STATUSES, body.status, "needed"),
      pickup_on: str(body, "pickup_on"),
      leftover_notes: str(body, "leftover_notes"),
    };
  }
  if (kind === "crew") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      role: inList(BAR_CREW_ROLES, body.role, "bartender"),
      tips_expires_on: str(body, "tips_expires_on"),
      food_handler_expires_on: str(body, "food_handler_expires_on"),
      rating: num(body, "rating"),
    };
  }
  return {
    ...base,
    title: str(body, "title") ?? "",
    kind: inList(BAR_ONSITE_KINDS, body.kind, "setup_photo"),
    image_url: str(body, "image_url"),
    incident_kind: body.incident_kind
      ? inList(BAR_INCIDENT_KINDS, body.incident_kind, "other")
      : null,
  };
}

export async function GET(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown bar resource" }, { status: 404 });
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
    return NextResponse.json({ error: "Unknown bar resource" }, { status: 404 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireWorkspaceMember(String(body.workspace_id ?? ""));
  if ("error" in auth) return auth.error;
  const spec = KINDS[kind];
  const payload = payloadFor(kind, auth.workspaceId, body);
  for (const key of spec.required) {
    if (!payload[key]) {
      return NextResponse.json(
        { error: `${key} is required` },
        { status: 400 }
      );
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
