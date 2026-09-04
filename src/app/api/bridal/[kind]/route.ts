import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  BRIDAL_ALT_STATUSES,
  BRIDAL_APPT_STATUSES,
  BRIDAL_CREW_ROLES,
  BRIDAL_ITEM_KINDS,
  BRIDAL_ITEM_STATUSES,
  BRIDAL_ORDER_KINDS,
  BRIDAL_ORDER_STATUSES,
  BRIDAL_RECEIVE_STATUSES,
  bridalDateFields,
  flattenBridalSpecs,
  formatBridalLocation,
} from "@/lib/bridalService";

const KINDS = {
  appointments: { table: "bridal_appointments", wrap: "rows", required: ["title"] },
  locations: { table: "bridal_locations", wrap: "rows", required: ["name"] },
  items: { table: "bridal_items", wrap: "items", required: ["title"] },
  vision: { table: "bridal_vision", wrap: "rows", required: ["title"] },
  fittings: { table: "bridal_fittings", wrap: "rows", required: ["title"] },
  orders: { table: "bridal_orders", wrap: "orders", required: ["title"] },
  alterations: { table: "bridal_alterations", wrap: "rows", required: ["title"] },
  party: { table: "bridal_party", wrap: "rows", required: ["title"] },
  crew: { table: "bridal_crew", wrap: "crew", required: ["name"] },
  receiving: { table: "bridal_receiving", wrap: "rows", required: ["title"] },
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
  if (kind === "appointments") {
    const dates = bridalDateFields(body);
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      title: str(body, "title") ?? "",
      starts_at: dates.starts_at,
      wedding_on: dates.wedding_on,
      party_size: num(body, "party_size"),
      budget_range: str(body, "budget_range"),
      style_prefs: str(body, "style_prefs"),
      venue_type: str(body, "venue_type"),
      season: str(body, "season"),
      theme_colors: str(body, "theme_colors"),
      lead_source: str(body, "lead_source"),
      stylist_name: str(body, "stylist_name"),
      status: inList(BRIDAL_APPT_STATUSES, body.status, "booked"),
    };
  }
  if (kind === "locations") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      zone: str(body, "zone"),
      map_url: str(body, "map_url"),
    };
  }
  if (kind === "items") {
    const rack = str(body, "rack");
    const section = str(body, "section");
    const hanger = str(body, "hanger");
    return {
      ...base,
      title: str(body, "title") ?? "",
      tag_code: str(body, "tag_code"),
      kind: inList(BRIDAL_ITEM_KINDS, body.kind, "gown"),
      style_name: str(body, "style_name"),
      size: str(body, "size"),
      color: str(body, "color"),
      designer: str(body, "designer"),
      price: num(body, "price"),
      cost: num(body, "cost"),
      qty: num(body, "qty") ?? 1,
      reorder_below: num(body, "reorder_below"),
      status: inList(BRIDAL_ITEM_STATUSES, body.status, "showroom"),
      rack,
      section,
      hanger,
      location_label:
        str(body, "location_label") ??
        (formatBridalLocation({ rack, section, hanger }) || null),
      sample_sale: bool(body, "sample_sale"),
    };
  }
  if (kind === "vision") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      image_url: str(body, "image_url"),
      silhouette: str(body, "silhouette"),
      neckline: str(body, "neckline"),
      fabric: str(body, "fabric"),
      match_notes: str(body, "match_notes"),
    };
  }
  if (kind === "fittings") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      starts_at: str(body, "starts_at"),
      pulled_tags: str(body, "pulled_tags"),
      photo_url: str(body, "photo_url"),
      favorites: str(body, "favorites"),
      loved: str(body, "loved"),
      disliked: str(body, "disliked"),
      sizing_notes: str(body, "sizing_notes"),
    };
  }
  if (kind === "orders") {
    const dates = bridalDateFields(body);
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      title: str(body, "title") ?? "",
      kind: inList(BRIDAL_ORDER_KINDS, body.kind, "in_stock"),
      tag_code: str(body, "tag_code"),
      designer: str(body, "designer"),
      eta_on: dates.eta_on,
      deposit_paid: bool(body, "deposit_paid"),
      retainer_amount: num(body, "retainer_amount") ?? 0,
      wedding_on: dates.wedding_on,
      status: inList(BRIDAL_ORDER_STATUSES, body.status, "deposit"),
    };
  }
  if (kind === "alterations") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      tag_code: str(body, "tag_code"),
      measurements: str(body, "measurements"),
      seamstress_name: str(body, "seamstress_name"),
      outsourced: bool(body, "outsourced"),
      photo_url: str(body, "photo_url"),
      next_fitting_at: str(body, "next_fitting_at"),
      status: inList(BRIDAL_ALT_STATUSES, body.status, "measured"),
    };
  }
  if (kind === "party") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      role: str(body, "role"),
      dress_notes: str(body, "dress_notes"),
      tag_code: str(body, "tag_code"),
    };
  }
  if (kind === "crew") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      role: inList(BRIDAL_CREW_ROLES, body.role, "stylist"),
      conversion_notes: str(body, "conversion_notes"),
      rating: num(body, "rating"),
    };
  }
  return {
    ...base,
    title: str(body, "title") ?? "",
    tag_code: str(body, "tag_code"),
    rack: str(body, "rack"),
    section: str(body, "section"),
    hanger: str(body, "hanger"),
    status: inList(BRIDAL_RECEIVE_STATUSES, body.status, "expected"),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown bridal resource" }, { status: 404 });
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
    return NextResponse.json({ error: "Unknown bridal resource" }, { status: 404 });
  }
  const raw = (await request.json()) as Record<string, unknown>;
  const body = kind === "items" ? flattenBridalSpecs(raw) : raw;
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
