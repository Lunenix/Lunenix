import "server-only";

import {
  PHOTO_COVERAGE,
  PHOTO_COVERAGE_LABELS,
  PHOTO_EDIT_STATUS_LABELS,
  PHOTO_SHOOT_TYPE_LABELS,
  PHOTO_SHOOT_TYPES,
  flattenPhotoSpecs,
  mapPhotoEditStage,
  mapPhotoSessionType,
  photoShootDateFields,
  photoShotListFromArgs,
} from "@/lib/photoService";
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

function bool(args: Record<string, unknown>, key: string): boolean {
  const v = args[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number" && Number.isFinite(v)) return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "1"].includes(s)) return true;
  }
  return false;
}

export async function executePhotoLunaTool(
  supabase: Db,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<VerticalExecutionResult | null> {
  if (name === "list_photo_shoots") {
    const { data, error } = await supabase
      .from("photo_shoots")
      .select("title, shoot_on, shoot_type, coverage, status")
      .eq("workspace_id", workspaceId)
      .order("shoot_on", { ascending: true })
      .limit(20);
    if (error) return { error: error.message };
    const lines = (data ?? []).map(
      (e: {
        title: string;
        shoot_on: string | null;
        shoot_type: string;
        coverage: string;
        status: string;
      }) =>
        `${e.title} ${e.shoot_on ?? "no date"}, ${e.shoot_type}, ${e.coverage}, ${e.status}`
    );
    return {
      ok: true,
      summary: lines.length
        ? lines.join(". ")
        : "No photo or video shoots in this workspace.",
    };
  }

  if (name === "photo_log_session_specs") {
    const flat = flattenPhotoSpecs(args);
    const hours = num(flat, "coverage_hours") ?? num(flat, "hours");
    if (hours == null) return { error: "Need coverage hours." };
    const sessionRaw = str(flat, "session_type");
    if (!sessionRaw) return { error: "Need a session type." };
    const contact = await resolveContact(supabase, workspaceId, flat);
    if (!contact) {
      return { error: "Need a client name so I can attach the session." };
    }
    if ("error" in contact) return contact;
    const shoot_type = mapPhotoSessionType(sessionRaw);
    const shots = photoShotListFromArgs(flat.shot_list);
    const style = str(flat, "style_notes");
    const usage = str(flat, "usage_rights");
    const title =
      str(flat, "title") ??
      `${contact.label} ${PHOTO_SHOOT_TYPE_LABELS[shoot_type]}`;
    const second = bool(flat, "second_shooter_required");

    const { data, error } = await supabase
      .from("photo_shoots")
      .insert({
        workspace_id: workspaceId,
        contact_id: contact.id,
        title: title.slice(0, 200),
        venue_name: str(flat, "venue_name"),
        shoot_type,
        hours,
        second_shooter: second,
        must_haves: shots.length ? shots.join("; ").slice(0, 2000) : null,
        status: "booked",
      })
      .select("title")
      .maybeSingle();
    if (error || !data) {
      return { error: error?.message ?? "Could not log those session specs." };
    }

    if (shots.length) {
      await supabase.from("photo_shots").insert(
        shots.map((shot) => ({
          workspace_id: workspaceId,
          title: shot.slice(0, 200),
          status: "planned",
        }))
      );
    }
    if (style) {
      await supabase.from("photo_mood").insert({
        workspace_id: workspaceId,
        title: `${contact.label} style`.slice(0, 200),
        style_notes: style.slice(0, 2000),
      });
    }
    if (usage) {
      await supabase.from("photo_releases").insert({
        workspace_id: workspaceId,
        title: `${contact.label} usage`.slice(0, 200),
        usage_notes: usage.slice(0, 2000),
      });
    }

    return {
      ok: true,
      summary: `Logged ${PHOTO_SHOOT_TYPE_LABELS[shoot_type]} specs for ${contact.label}, ${hours} hours${second ? ", second shooter" : ""}${shots.length ? `, ${shots.length} must-have shots` : ""}.`,
    };
  }

  if (name === "photo_update_post_production") {
    const flat = flattenPhotoSpecs(args);
    const stageRaw = str(flat, "editing_stage") ?? str(flat, "culling_status");
    if (!stageRaw) return { error: "Need an editing stage." };
    const contact = await resolveContact(supabase, workspaceId, flat);
    if (!contact) {
      return { error: "Need a client name so I can update post-production." };
    }
    if ("error" in contact) return contact;
    const editStatus = mapPhotoEditStage(stageRaw);
    const due = str(flat, "turnaround_deadline");
    const dueOn = due ? due.slice(0, 10) : null;
    const galleryUrl = str(flat, "gallery_url");

    const { error: editErr } = await supabase.from("photo_edits").insert({
      workspace_id: workspaceId,
      title: `${contact.label} edits`.slice(0, 200),
      due_on: dueOn,
      status: editStatus,
    });
    if (editErr) return { error: editErr.message };

    if (galleryUrl) {
      await supabase.from("photo_galleries").insert({
        workspace_id: workspaceId,
        title: `${contact.label} gallery`.slice(0, 200),
        gallery_url: galleryUrl.slice(0, 2000),
        status: "sent",
      });
    }

    const { data: shoot } = await supabase
      .from("photo_shoots")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (shoot?.id) {
      await supabase
        .from("photo_shoots")
        .update({
          status: editStatus === "delivered" ? "delivered" : "editing",
        })
        .eq("workspace_id", workspaceId)
        .eq("id", shoot.id);
    }

    return {
      ok: true,
      summary: `Updated post-production for ${contact.label} to ${PHOTO_EDIT_STATUS_LABELS[editStatus]}${galleryUrl ? " and saved the gallery URL" : ""}. This is not a hosted proofing site.`,
    };
  }

  if (name !== "photo_log_shoot") return null;

  const flat = flattenPhotoSpecs(args);
  const title = str(flat, "title");
  if (!title) return { error: "Need a shoot title." };
  const contact = await resolveContact(supabase, workspaceId, flat);
  if (contact && "error" in contact) return contact;
  const dates = photoShootDateFields(flat);
  const typeRaw = str(flat, "shoot_type") ?? "wedding";
  const shoot_type = (PHOTO_SHOOT_TYPES as readonly string[]).includes(typeRaw)
    ? typeRaw
    : "wedding";
  const covRaw = str(flat, "coverage") ?? "photo";
  const coverage = (PHOTO_COVERAGE as readonly string[]).includes(covRaw)
    ? covRaw
    : "photo";

  const { data, error } = await supabase
    .from("photo_shoots")
    .insert({
      workspace_id: workspaceId,
      contact_id: contact && "id" in contact ? contact.id : null,
      title: title.slice(0, 200),
      shoot_on: dates.shoot_on,
      starts_at: dates.starts_at,
      venue_name: str(flat, "venue_name"),
      shoot_type,
      coverage,
      hours: num(flat, "hours"),
      second_shooter: bool(flat, "second_shooter") || bool(flat, "second_shooter_required"),
      status: "booked",
    })
    .select("title")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "Could not log that shoot." };
  }
  return {
    ok: true,
    summary: `Logged ${PHOTO_SHOOT_TYPE_LABELS[shoot_type as keyof typeof PHOTO_SHOOT_TYPE_LABELS]} (${PHOTO_COVERAGE_LABELS[coverage as keyof typeof PHOTO_COVERAGE_LABELS]}) for ${data.title}.`,
  };
}
