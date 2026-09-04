import "server-only";

import { isScheduleStatus } from "@/lib/hubSchedule";
import { sendWorkspaceTelegram } from "@/lib/sms-persist";
import { contactDisplayName } from "@/types/database";
import type { VerticalExecutionResult } from "@/lib/verticals/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HUB_TOOLS = new Set([
  "create_booking",
  "schedule_event",
  "list_bookings",
  "send_sms",
  "send_telegram",
  "list_sms_threads",
]);

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
): Promise<{ id: string; label: string; telegramChatId: string | null } | { error: string } | null> {
  const idRaw = str(args, "contact_id");
  if (idRaw && UUID_RE.test(idRaw)) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, type, first_name, last_name, organization_name, email, telegram_chat_id")
      .eq("workspace_id", workspaceId)
      .eq("id", idRaw)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "I could not find that contact in this workspace." };
    return {
      id: data.id,
      label: contactDisplayName(data),
      telegramChatId:
        typeof data.telegram_chat_id === "string" ? data.telegram_chat_id : null,
    };
  }
  const name = str(args, "contact_name") || str(args, "contact_email");
  if (!name) return null;
  const safe = name.replace(/[,()%*]/g, "").trim().slice(0, 80);
  if (!safe) return null;
  const { data, error } = await supabase
    .from("contacts")
    .select("id, type, first_name, last_name, organization_name, email, telegram_chat_id")
    .eq("workspace_id", workspaceId)
    .or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,organization_name.ilike.%${safe}%,email.ilike.%${safe}%`
    )
    .limit(5);
  if (error) return { error: error.message };
  const rows = data ?? [];
  if (!rows.length) {
    return { error: "I could not find that contact in this workspace." };
  }
  if (rows.length > 1) {
    return {
      error: `Several contacts match. Which one: ${rows
        .map((r: Parameters<typeof contactDisplayName>[0]) => contactDisplayName(r))
        .join(", ")}?`,
    };
  }
  const row = rows[0];
  return {
    id: row.id,
    label: contactDisplayName(row),
    telegramChatId:
      typeof row.telegram_chat_id === "string" ? row.telegram_chat_id : null,
  };
}

function parseStartsAt(args: Record<string, unknown>): Date | { error: string } {
  const iso = str(args, "starts_at") || str(args, "start_at") || str(args, "when");
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const date = str(args, "start_date") || str(args, "date");
  const time = str(args, "start_time") || str(args, "time") || "09:00";
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return { error: "Need a start time for that booking." };
}

export async function executeHubScheduleSmsTool(
  supabase: Db,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<VerticalExecutionResult | null> {
  if (!HUB_TOOLS.has(name)) return null;

  if (name === "list_bookings") {
    const { data, error } = await supabase
      .from("schedule_events")
      .select("title, starts_at, status, location")
      .eq("workspace_id", workspaceId)
      .neq("status", "cancelled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(20);
    if (error) return { error: error.message };
    const lines = (data ?? []).map(
      (row: {
        title: string;
        starts_at: string;
        status: string;
        location: string | null;
      }) => {
        const when = new Date(row.starts_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        return `${row.title} ${when}${row.location ? ` at ${row.location}` : ""}, ${row.status}`;
      }
    );
    return {
      ok: true,
      summary: lines.length
        ? `Upcoming bookings: ${lines.join(". ")}.`
        : "No upcoming bookings on the schedule.",
    };
  }

  if (name === "list_sms_threads") {
    const { data, error } = await supabase
      .from("sms_threads")
      .select(
        "last_message_at, contact:contacts(type, first_name, last_name, organization_name, email)"
      )
      .eq("workspace_id", workspaceId)
      .order("last_message_at", { ascending: false })
      .limit(15);
    if (error) return { error: error.message };
    const lines = (data ?? []).map(
      (row: {
        last_message_at: string;
        contact?: Parameters<typeof contactDisplayName>[0] | Parameters<typeof contactDisplayName>[0][] | null;
      }) => {
        const c = Array.isArray(row.contact) ? row.contact[0] : row.contact;
        const label = c ? contactDisplayName(c) : "Unknown contact";
        return label;
      }
    );
    return {
      ok: true,
      summary: lines.length
        ? `Recent Telegram threads: ${lines.join(", ")}.`
        : "No Telegram conversations in this workspace yet.",
    };
  }

  if (name === "send_sms" || name === "send_telegram") {
    const contact = await resolveContact(supabase, workspaceId, args);
    if (!contact) {
      return { error: "Say who to message. Use a contact name in this workspace." };
    }
    if ("error" in contact) return contact;
    const body = str(args, "body") || str(args, "message") || str(args, "text");
    if (!body) return { error: "What should the Telegram message say?" };
    if (!contact.telegramChatId) {
      return {
        error: `${contact.label} has not opened the workspace Telegram bot yet.`,
      };
    }
    const sent = await sendWorkspaceTelegram(supabase, {
      workspaceId,
      chatId: contact.telegramChatId,
      body,
      contactId: contact.id,
    });
    if ("error" in sent) return sent;
    return { ok: true, summary: `Telegram message sent to ${contact.label}.` };
  }

  const title =
    str(args, "title") ||
    str(args, "summary") ||
    str(args, "name") ||
    "Appointment";
  const starts = parseStartsAt(args);
  if ("error" in starts) return starts;
  const duration = num(args, "duration_minutes") ?? 60;
  const ends = new Date(starts.getTime() + Math.max(15, duration) * 60_000);
  const contact = await resolveContact(supabase, workspaceId, args);
  if (contact && "error" in contact) return contact;
  const statusRaw = str(args, "status") ?? "scheduled";
  const status = isScheduleStatus(statusRaw) ? statusRaw : "scheduled";
  const { data, error } = await supabase
    .from("schedule_events")
    .insert({
      workspace_id: workspaceId,
      contact_id: contact?.id ?? null,
      title: title.slice(0, 200),
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location: str(args, "location"),
      notes: str(args, "notes") || str(args, "description"),
      status,
    })
    .select("title, starts_at")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "Could not create that booking." };
  }
  const when = new Date(data.starts_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const who = contact && !("error" in contact) ? ` with ${contact.label}` : "";
  return {
    ok: true,
    summary: `Booked ${data.title}${who} on ${when}.`,
  };
}
