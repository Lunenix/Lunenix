import "server-only";

import {
  CHEF_SERVICE_TYPE_LABELS,
  CHEF_SERVICE_TYPES,
  chefVisitDateFields,
  flattenChefSpecs,
} from "@/lib/chefService";
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
    const labels = rows.map(
      (r: Parameters<typeof contactDisplayName>[0] & { id: string }) =>
        contactDisplayName(r)
    );
    return {
      error: `Several contacts match. Which one: ${labels.join(", ")}?`,
    };
  }
  return { id: rows[0].id, label: contactDisplayName(rows[0]) };
}

export async function executeChefLunaTool(
  supabase: Db,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<VerticalExecutionResult | null> {
  if (name === "list_chef_visits") {
    const { data, error } = await supabase
      .from("chef_visits")
      .select("title, visit_on, household_size, service_type, status")
      .eq("workspace_id", workspaceId)
      .order("visit_on", { ascending: true })
      .limit(20);
    if (error) return { error: error.message };
    const lines = (data ?? []).map(
      (e: {
        title: string;
        visit_on: string | null;
        household_size: number | null;
        service_type: string;
        status: string;
      }) =>
        `${e.title} ${e.visit_on ?? "no date"}, ${e.household_size ?? "?"} people, ${e.service_type}, ${e.status}`
    );
    return {
      ok: true,
      summary: lines.length
        ? lines.join(". ")
        : "No chef visits in this workspace.",
    };
  }

  if (name !== "chef_log_visit") return null;

  const flat = flattenChefSpecs(args);
  const household = num(flat, "household_size");
  if (household == null) return { error: "Need a household size." };
  const contact = await resolveContact(supabase, workspaceId, flat);
  if (contact && "error" in contact) return contact;
  const dates = chefVisitDateFields(flat);
  const typeRaw = str(flat, "service_type") ?? "meal_prep";
  const service_type = (CHEF_SERVICE_TYPES as readonly string[]).includes(typeRaw)
    ? typeRaw
    : "meal_prep";
  const title =
    str(flat, "title") ??
    `${contact && "label" in contact ? contact.label : "Client"} visit`;

  const { data, error } = await supabase
    .from("chef_visits")
    .insert({
      workspace_id: workspaceId,
      contact_id: contact && "id" in contact ? contact.id : null,
      title: title.slice(0, 200),
      visit_on: dates.visit_on,
      starts_at: dates.starts_at,
      household_size: household,
      service_type,
      grocery_cost: num(flat, "grocery_cost"),
      chef_fee: num(flat, "chef_fee"),
      status: "scheduled",
    })
    .select("title")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "Could not log that visit." };
  }
  return {
    ok: true,
    summary: `Logged ${CHEF_SERVICE_TYPE_LABELS[service_type as keyof typeof CHEF_SERVICE_TYPE_LABELS]} for ${data.title}, household of ${household}.`,
  };
}
