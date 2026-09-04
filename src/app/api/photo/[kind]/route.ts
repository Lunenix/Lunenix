import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  PHOTO_COVERAGE,
  PHOTO_DELIVERY_METHODS,
  PHOTO_EDIT_STATUSES,
  PHOTO_GALLERY_STATUSES,
  PHOTO_ORDER_STATUSES,
  PHOTO_PERMIT_STATUSES,
  PHOTO_SHOOT_STATUSES,
  PHOTO_SHOOT_TYPES,
  PHOTO_SHOT_STATUSES,
  PHOTO_VIDEO_STAGES,
  flattenPhotoSpecs,
  photoShootDateFields,
} from "@/lib/photoService";

const KINDS = {
  shoots: { table: "photo_shoots", wrap: "events", required: ["title"] },
  shots: { table: "photo_shots", wrap: "rows", required: ["title"] },
  mood: { table: "photo_mood", wrap: "rows", required: ["title"] },
  edits: { table: "photo_edits", wrap: "rows", required: ["title"] },
  galleries: { table: "photo_galleries", wrap: "rows", required: ["title"] },
  orders: { table: "photo_orders", wrap: "rows", required: ["title"] },
  gear: { table: "photo_gear", wrap: "rows", required: ["title"] },
  crew: { table: "photo_crew", wrap: "crew", required: ["name"] },
  releases: { table: "photo_releases", wrap: "rows", required: ["title"] },
  packages: { table: "photo_packages", wrap: "rows", required: ["title"] },
  permits: { table: "photo_permits", wrap: "rows", required: ["title"] },
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
    if (["true", "yes", "1"].includes(s)) return true;
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
  if (kind === "shoots") {
    const dates = photoShootDateFields(body);
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      title: str(body, "title") ?? "",
      shoot_on: dates.shoot_on,
      starts_at: dates.starts_at,
      venue_name: str(body, "venue_name"),
      shoot_type: inList(PHOTO_SHOOT_TYPES, body.shoot_type, "wedding"),
      coverage: inList(PHOTO_COVERAGE, body.coverage, "photo"),
      hours: num(body, "hours"),
      second_shooter: bool(body, "second_shooter"),
      lead_source: str(body, "lead_source"),
      budget_range: str(body, "budget_range"),
      package_name: str(body, "package_name"),
      add_ons: str(body, "add_ons"),
      timeline: str(body, "timeline"),
      packed_checklist: str(body, "packed_checklist"),
      scout_notes: str(body, "scout_notes"),
      must_haves: str(body, "must_haves"),
      status: inList(PHOTO_SHOOT_STATUSES, body.status, "inquiry"),
    };
  }
  if (kind === "shots") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      scene: str(body, "scene"),
      priority: str(body, "priority"),
      status: inList(PHOTO_SHOT_STATUSES, body.status, "planned"),
    };
  }
  if (kind === "mood") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      image_url: str(body, "image_url"),
      style_notes: str(body, "style_notes"),
    };
  }
  if (kind === "edits") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      due_on: str(body, "due_on"),
      editor_name: str(body, "editor_name"),
      video_stage: inList(PHOTO_VIDEO_STAGES, body.video_stage, "none"),
      status: inList(PHOTO_EDIT_STATUSES, body.status, "culling"),
    };
  }
  if (kind === "galleries") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      gallery_url: str(body, "gallery_url"),
      expires_on: str(body, "expires_on"),
      delivery_method: inList(PHOTO_DELIVERY_METHODS, body.delivery_method, "download"),
      favorites: str(body, "favorites"),
      status: inList(PHOTO_GALLERY_STATUSES, body.status, "draft"),
    };
  }
  if (kind === "orders") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      vendor_name: str(body, "vendor_name"),
      status: inList(PHOTO_ORDER_STATUSES, body.status, "needed"),
    };
  }
  if (kind === "crew") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      role: str(body, "role"),
      specialty: str(body, "specialty"),
      rating: num(body, "rating"),
    };
  }
  if (kind === "releases") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      usage_notes: str(body, "usage_notes"),
      signed_on: str(body, "signed_on"),
    };
  }
  if (kind === "packages") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      hours: num(body, "hours"),
      shooters: num(body, "shooters"),
      coverage: inList(PHOTO_COVERAGE, body.coverage, "photo"),
      deliverables: str(body, "deliverables"),
      add_ons: str(body, "add_ons"),
    };
  }
  if (kind === "permits") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      venue_name: str(body, "venue_name"),
      status: inList(PHOTO_PERMIT_STATUSES, body.status, "needed"),
      due_on: str(body, "due_on"),
    };
  }
  return {
    ...base,
    title: str(body, "title") ?? "",
    qty: num(body, "qty"),
    reorder_below: num(body, "reorder_below"),
    serial_no: str(body, "serial_no"),
    condition: str(body, "condition"),
    insurance_notes: str(body, "insurance_notes"),
    checked_out: bool(body, "checked_out"),
    checked_to: str(body, "checked_to"),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown photo resource" }, { status: 404 });
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
    return NextResponse.json({ error: "Unknown photo resource" }, { status: 404 });
  }
  const raw = (await request.json()) as Record<string, unknown>;
  const body = kind === "shoots" ? flattenPhotoSpecs(raw) : raw;
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
