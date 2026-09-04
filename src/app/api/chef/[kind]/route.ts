import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  CHEF_ENTRY_METHODS,
  CHEF_MENU_KINDS,
  CHEF_MENU_STATUSES,
  CHEF_PLAN_FREQUENCIES,
  CHEF_SERVICE_TYPES,
  CHEF_VISIT_STATUSES,
  chefVisitDateFields,
  flattenChefSpecs,
} from "@/lib/chefService";

const KINDS = {
  profiles: { table: "chef_profiles", wrap: "rows", required: ["title"] },
  access: { table: "chef_access", wrap: "rows", required: ["title"] },
  menus: { table: "chef_menus", wrap: "rows", required: ["title"] },
  vision: { table: "chef_vision", wrap: "rows", required: ["title"] },
  plans: { table: "chef_plans", wrap: "rows", required: ["title"] },
  visits: { table: "chef_visits", wrap: "events", required: ["title"] },
  shopping: { table: "chef_shopping", wrap: "rows", required: ["title"] },
  labels: { table: "chef_labels", wrap: "rows", required: ["title"] },
  crew: { table: "chef_crew", wrap: "crew", required: ["name"] },
  equipment: { table: "chef_equipment", wrap: "rows", required: ["title"] },
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
  if (kind === "profiles") {
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      title: str(body, "title") ?? "",
      service_type: inList(CHEF_SERVICE_TYPES, body.service_type, "meal_prep"),
      household_size: num(body, "household_size"),
      dietary_notes: str(body, "dietary_notes"),
      allergies: str(body, "allergies"),
      dislikes: str(body, "dislikes"),
      health_goals: str(body, "health_goals"),
      favorites: str(body, "favorites"),
      never_make: str(body, "never_make"),
      meal_times: str(body, "meal_times"),
      portions: str(body, "portions"),
      budget_range: str(body, "budget_range"),
      lead_source: str(body, "lead_source"),
    };
  }
  if (kind === "access") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      entry_method: inList(CHEF_ENTRY_METHODS, body.entry_method, "present"),
      entry_notes: str(body, "entry_notes"),
      kitchen_on_hand: str(body, "kitchen_on_hand"),
      bring_list: str(body, "bring_list"),
      pet_notes: str(body, "pet_notes"),
      storage_notes: str(body, "storage_notes"),
    };
  }
  if (kind === "menus") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      kind: inList(CHEF_MENU_KINDS, body.kind, "weekly"),
      dishes: str(body, "dishes"),
      nutrition_notes: str(body, "nutrition_notes"),
      status: inList(CHEF_MENU_STATUSES, body.status, "draft"),
    };
  }
  if (kind === "vision") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      image_url: str(body, "image_url"),
      presentation_notes: str(body, "presentation_notes"),
    };
  }
  if (kind === "plans") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      frequency: inList(CHEF_PLAN_FREQUENCIES, body.frequency, "weekly"),
      paused: bool(body, "paused"),
      skip_notes: str(body, "skip_notes"),
    };
  }
  if (kind === "visits") {
    const dates = chefVisitDateFields(body);
    return {
      ...base,
      contact_id: str(body, "contact_id"),
      title: str(body, "title") ?? "",
      visit_on: dates.visit_on,
      starts_at: dates.starts_at,
      service_type: inList(CHEF_SERVICE_TYPES, body.service_type, "meal_prep"),
      household_size: num(body, "household_size"),
      grocery_cost: num(body, "grocery_cost"),
      chef_fee: num(body, "chef_fee"),
      dietary_notes: str(body, "dietary_notes"),
      kitchen_access: str(body, "kitchen_access"),
      budget_range: str(body, "budget_range"),
      lead_source: str(body, "lead_source"),
      checklist: str(body, "checklist"),
      status: inList(CHEF_VISIT_STATUSES, body.status, "scheduled"),
      photo_url: str(body, "photo_url"),
    };
  }
  if (kind === "shopping") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      vendor_name: str(body, "vendor_name"),
      list_text: str(body, "list_text"),
      receipt_notes: str(body, "receipt_notes"),
    };
  }
  if (kind === "labels") {
    return {
      ...base,
      title: str(body, "title") ?? "",
      made_on: str(body, "made_on"),
      reheat_notes: str(body, "reheat_notes"),
      shelf_life: str(body, "shelf_life"),
      allergy_precautions: str(body, "allergy_precautions"),
    };
  }
  if (kind === "crew") {
    return {
      ...base,
      name: str(body, "name") ?? "",
      cert: str(body, "cert"),
      rating: num(body, "rating"),
    };
  }
  return {
    ...base,
    title: str(body, "title") ?? "",
    qty: num(body, "qty"),
    reorder_below: num(body, "reorder_below"),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { kind: string } }
) {
  const kind = pickKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown chef resource" }, { status: 404 });
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
    return NextResponse.json({ error: "Unknown chef resource" }, { status: 404 });
  }
  const raw = (await request.json()) as Record<string, unknown>;
  const body = kind === "visits" ? flattenChefSpecs(raw) : raw;
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
