import "server-only";

import {
  PLANNER_EVENT_TYPES,
  PLANNER_TIER_LABELS,
  PLANNER_TIERS,
  flattenPlannerSpecs,
  plannerEventDateFields,
} from "@/lib/plannerService";
import { contactDisplayName } from "@/types/database";
import type { VerticalExecutionResult } from "@/lib/verticals/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (relation: string) => any };

function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(args: Record<string, unknown>, key: string): number | null {
  const v = args[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function bool(args: Record<string, unknown>, key: string): boolean {
  const v = args[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

async function resolveContact(
  supabase: Db,
  workspaceId: string,
  args: Record<string, unknown>
): Promise<{ id: string; label: string } | { error: string } | null> {
  const idRaw = str(args, "contact_id");
  if (idRaw && UUID_RE.test(idRaw)) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, type, first_name, last_name, organization_name, email")
      .eq("workspace_id", workspaceId)
      .eq("id", idRaw)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "I could not find that contact in this workspace." };
    return { id: data.id, label: contactDisplayName(data) };
  }
  const name = str(args, "contact_name");
  if (!name) return null;
  const safe = name.replace(/[,()%*]/g, "").trim().slice(0, 80);
  if (!safe) return null;
  const { data, error } = await supabase
    .from("contacts")
    .select("id, type, first_name, last_name, organization_name, email")
    .eq("workspace_id", workspaceId)
    .or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,organization_name.ilike.%${safe}%`
    )
    .limit(5);
  if (error) return { error: error.message };
  const rows = data ?? [];
  if (!rows.length) {
    return { error: "I could not find that contact in this workspace." };
  }
  if (rows.length > 1) {
    return {
      error: `Several contacts match. Which one: ${rows.map((r: { first_name?: string }) => contactDisplayName(r)).join(", ")}?`,
    };
  }
  return { id: rows[0].id, label: contactDisplayName(rows[0]) };
}

export async function executePlannerLunaTool(
  supabase: Db,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<VerticalExecutionResult | null> {
  if (name === "list_planner_events") {
    const { data, error } = await supabase
      .from("planner_events")
      .select("title, event_on, venue_name, guest_count, planning_tier, status")
      .eq("workspace_id", workspaceId)
      .order("event_on", { ascending: true })
      .limit(20);
    if (error) return { error: error.message };
    const lines = (data ?? []).map(
      (e: {
        title: string;
        event_on: string | null;
        venue_name: string | null;
        guest_count: number | null;
        planning_tier: string;
        status: string;
      }) =>
        `${e.title} ${e.event_on ?? "no date"} at ${e.venue_name ?? "no venue"}, ${e.guest_count ?? "?"} guests, ${e.planning_tier}, ${e.status}`
    );
    return {
      ok: true,
      summary: lines.length
        ? lines.join(". ")
        : "No planned events in this workspace.",
    };
  }

  if (name !== "planner_log_event_specs") return null;

  const flat = flattenPlannerSpecs(args);
  const guestCount = num(flat, "guest_count");
  if (guestCount == null) return { error: "Need a guest count." };
  const contact = await resolveContact(supabase, workspaceId, flat);
  if (contact && "error" in contact) return contact;
  const dates = plannerEventDateFields(flat);
  const tierRaw = str(flat, "planning_tier") ?? "full";
  const planning_tier = (PLANNER_TIERS as readonly string[]).includes(tierRaw)
    ? tierRaw
    : "full";
  const event_type = (PLANNER_EVENT_TYPES as readonly string[]).includes(
    str(flat, "event_type") ?? ""
  )
    ? str(flat, "event_type")
    : "wedding";
  const title =
    str(flat, "title") ??
    `${contact && "label" in contact ? contact.label : "Client"} event`;

  const { data, error } = await supabase
    .from("planner_events")
    .insert({
      workspace_id: workspaceId,
      contact_id: contact && "id" in contact ? contact.id : null,
      title: title.slice(0, 200),
      event_on: dates.event_on,
      venue_name: str(flat, "venue_name"),
      venue_address: str(flat, "venue_address"),
      guest_count: guestCount,
      event_type,
      planning_tier,
      budget_range: str(flat, "budget_range"),
      deposit_paid: bool(flat, "deposit_paid"),
      retainer_amount: num(flat, "retainer_amount") ?? 0,
      status: "inquiry",
    })
    .select("title")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "Could not log that event." };
  }
  return {
    ok: true,
    summary: `Logged ${PLANNER_TIER_LABELS[planning_tier as keyof typeof PLANNER_TIER_LABELS]} for ${data.title}, ${guestCount} guests.`,
  };
}
