import "server-only";

import {
  VENUE_EVENT_TYPES,
  VENUE_TIER_LABELS,
  VENUE_TIERS,
  flattenVenueSpecs,
  venueBookingDateFields,
} from "@/lib/venueService";
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

export async function executeVenueLunaTool(
  supabase: Db,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<VerticalExecutionResult | null> {
  if (name === "list_venue_bookings") {
    const { data, error } = await supabase
      .from("venue_bookings")
      .select("title, event_on, space_name, guest_count, rental_tier, status")
      .eq("workspace_id", workspaceId)
      .order("event_on", { ascending: true })
      .limit(20);
    if (error) return { error: error.message };
    const lines = (data ?? []).map(
      (e: {
        title: string;
        event_on: string | null;
        space_name: string | null;
        guest_count: number | null;
        rental_tier: string;
        status: string;
      }) =>
        `${e.title} ${e.event_on ?? "no date"} in ${e.space_name ?? "unassigned space"}, ${e.guest_count ?? "?"} guests, ${e.rental_tier}, ${e.status}`
    );
    return {
      ok: true,
      summary: lines.length
        ? lines.join(". ")
        : "No venue bookings in this workspace.",
    };
  }

  if (name !== "venue_log_booking") return null;

  const flat = flattenVenueSpecs(args);
  const guestCount = num(flat, "guest_count");
  if (guestCount == null) return { error: "Need a guest count." };
  const contact = await resolveContact(supabase, workspaceId, flat);
  if (contact && "error" in contact) return contact;
  const dates = venueBookingDateFields(flat);
  const tierRaw = str(flat, "rental_tier") ?? "ceremony_reception";
  const rental_tier = (VENUE_TIERS as readonly string[]).includes(tierRaw)
    ? tierRaw
    : "ceremony_reception";
  const event_type = (VENUE_EVENT_TYPES as readonly string[]).includes(
    str(flat, "event_type") ?? ""
  )
    ? str(flat, "event_type")
    : "wedding";
  const title =
    str(flat, "title") ??
    `${contact && "label" in contact ? contact.label : "Client"} booking`;

  const { data, error } = await supabase
    .from("venue_bookings")
    .insert({
      workspace_id: workspaceId,
      contact_id: contact && "id" in contact ? contact.id : null,
      title: title.slice(0, 200),
      event_on: dates.event_on,
      space_name: str(flat, "space_name"),
      guest_count: guestCount,
      event_type,
      rental_tier,
      deposit_paid: bool(flat, "deposit_paid"),
      retainer_amount: num(flat, "retainer_amount") ?? 0,
      status: "inquiry",
    })
    .select("title")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "Could not log that booking." };
  }
  return {
    ok: true,
    summary: `Logged ${VENUE_TIER_LABELS[rental_tier as keyof typeof VENUE_TIER_LABELS]} for ${data.title}, ${guestCount} guests.`,
  };
}
