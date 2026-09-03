import "server-only";

import {
  BAR_PACKAGE_TIER_LABELS,
  barEventDateFields,
  flattenBarEventSpecs,
  mapBarPackageTier,
} from "@/lib/barService";
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

function cocktailLines(args: Record<string, unknown>): string | null {
  const raw = args.cocktail_list;
  if (Array.isArray(raw)) {
    const parts = raw
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  return str(args, "cocktail_list");
}

async function resolveContact(
  supabase: Db,
  workspaceId: string,
  args: Record<string, unknown>
): Promise<{ id: string; label: string } | { error: string }> {
  const idRaw = str(args, "contact_id");
  if (idRaw && UUID_RE.test(idRaw)) {
    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, type, first_name, last_name, organization_name, email"
      )
      .eq("workspace_id", workspaceId)
      .eq("id", idRaw)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) {
      return { error: "I could not find that contact in this workspace." };
    }
    return { id: data.id, label: contactDisplayName(data) };
  }

  const name = str(args, "contact_name") ?? str(args, "client_name");
  if (!name) {
    return { error: "Need a client name in this workspace." };
  }

  const safe = name.replace(/[,()%*]/g, "").trim().slice(0, 80);
  if (!safe) {
    return { error: "Need a client name in this workspace." };
  }

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, type, first_name, last_name, organization_name, email"
    )
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
    const labels = rows.map((r: Parameters<typeof contactDisplayName>[0] & { id: string }) =>
      contactDisplayName(r)
    );
    return {
      error: `Several contacts match. Which one: ${labels.join(", ")}?`,
    };
  }
  return { id: rows[0].id, label: contactDisplayName(rows[0]) };
}

/**
 * Bar pack tools. Writes bar_events / bar_menus / bar_compliance, not contacts.metadata.
 */
export async function executeBarLunaTool(
  supabase: Db,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<VerticalExecutionResult | null> {
  if (name !== "bartending_log_event_specs") return null;

  const flat = flattenBarEventSpecs(args);
  const guestCount = num(flat, "guest_count");
  if (guestCount == null) {
    return { error: "Need a guest count." };
  }
  const packageRaw = str(flat, "bar_package") ?? str(flat, "package_tier");
  if (!packageRaw) {
    return { error: "Need a bar package." };
  }

  const contact = await resolveContact(supabase, workspaceId, flat);
  if ("error" in contact) return contact;

  const dates = barEventDateFields(flat);
  const packageTier = mapBarPackageTier(packageRaw);
  const cocktails = cocktailLines(flat);
  const licensing = bool(flat, "licensing_required");
  const title = `${contact.label} event`;

  let existingQuery = supabase
    .from("bar_events")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contact.id);
  if (dates.event_on) {
    existingQuery = existingQuery.eq("event_on", dates.event_on);
  }
  const { data: existingRows } = await existingQuery
    .order("created_at", { ascending: false })
    .limit(1);
  const existing = existingRows?.[0] as { id: string; title: string } | undefined;

  let eventTitle = existing?.title ?? title;
  if (existing?.id) {
    const { data, error } = await supabase
      .from("bar_events")
      .update({
        event_on: dates.event_on,
        event_start_at: dates.event_start_at,
        guest_count: guestCount,
        package_tier: packageTier,
        must_haves: cocktails,
      })
      .eq("id", existing.id)
      .eq("workspace_id", workspaceId)
      .select("title")
      .maybeSingle();
    if (error || !data) {
      return { error: error?.message ?? "Could not update that event." };
    }
    eventTitle = data.title;
  } else {
    const { data, error } = await supabase
      .from("bar_events")
      .insert({
        workspace_id: workspaceId,
        contact_id: contact.id,
        title,
        event_on: dates.event_on,
        event_start_at: dates.event_start_at,
        guest_count: guestCount,
        package_tier: packageTier,
        must_haves: cocktails,
        status: "inquiry",
      })
      .select("title")
      .maybeSingle();
    if (error || !data) {
      return { error: error?.message ?? "Could not log that event." };
    }
    eventTitle = data.title;
  }

  if (cocktails) {
    await supabase.from("bar_menus").insert({
      workspace_id: workspaceId,
      contact_id: contact.id,
      name: `${BAR_PACKAGE_TIER_LABELS[packageTier]} menu`,
      package_tier: packageTier,
      cocktails,
      status: "draft",
    });
  }

  if (licensing) {
    await supabase.from("bar_compliance").insert({
      workspace_id: workspaceId,
      name: `Liquor permit: ${eventTitle}`,
      kind: "catering_permit",
      status: "needed",
    });
  }

  const drinkBit = cocktails ? ` Signature drinks noted.` : "";
  const permitBit = licensing
    ? " A liquor permit was flagged as needed."
    : "";
  return {
    ok: true,
    summary: `Logged ${BAR_PACKAGE_TIER_LABELS[packageTier]} for ${contact.label}, ${guestCount} guests.${drinkBit}${permitBit}`,
  };
}
