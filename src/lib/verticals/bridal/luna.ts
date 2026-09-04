import "server-only";

import {
  BRIDAL_ITEM_KINDS,
  BRIDAL_ITEM_STATUSES,
  flattenBridalSpecs,
  formatBridalLocation,
} from "@/lib/bridalService";
import type { VerticalExecutionResult } from "@/lib/verticals/types";

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

export async function executeBridalLunaTool(
  supabase: Db,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<VerticalExecutionResult | null> {
  if (name === "list_bridal_items") {
    let q = supabase
      .from("bridal_items")
      .select(
        "title, tag_code, style_name, size, designer, status, location_label, rack, section, hanger"
      )
      .eq("workspace_id", workspaceId)
      .limit(20);
    const style = str(args, "style_name");
    const size = str(args, "size");
    const designer = str(args, "designer");
    const tag = str(args, "tag_code");
    if (style) q = q.ilike("style_name", `%${style.replace(/[,()%*]/g, "")}%`);
    if (size) q = q.ilike("size", `%${size.replace(/[,()%*]/g, "")}%`);
    if (designer) q = q.ilike("designer", `%${designer.replace(/[,()%*]/g, "")}%`);
    if (tag) q = q.ilike("tag_code", `%${tag.replace(/[,()%*]/g, "")}%`);
    const { data, error } = await q;
    if (error) return { error: error.message };
    const lines = (data ?? []).map(
      (e: {
        title: string;
        tag_code: string | null;
        style_name: string | null;
        size: string | null;
        designer: string | null;
        status: string;
        location_label: string | null;
        rack: string | null;
        section: string | null;
        hanger: string | null;
      }) => {
        const loc =
          e.location_label ||
          formatBridalLocation({
            rack: e.rack,
            section: e.section,
            hanger: e.hanger,
          }) ||
          "no floor location";
        return `${e.title} ${e.designer ?? ""} size ${e.size ?? "?"}, ${e.status}, ${loc}${e.tag_code ? `, tag ${e.tag_code}` : ""}`;
      }
    );
    return {
      ok: true,
      summary: lines.length
        ? lines.join(". ")
        : "No tagged items matched in this workspace.",
    };
  }

  if (name !== "bridal_log_item") return null;

  const flat = flattenBridalSpecs(args);
  const title = str(flat, "title");
  if (!title) return { error: "Need an item name." };
  const rack = str(flat, "rack");
  const section = str(flat, "section");
  const hanger = str(flat, "hanger");
  const kindRaw = str(flat, "kind") ?? "gown";
  const kind = (BRIDAL_ITEM_KINDS as readonly string[]).includes(kindRaw)
    ? kindRaw
    : "gown";
  const statusRaw = str(flat, "status") ?? "showroom";
  const status = (BRIDAL_ITEM_STATUSES as readonly string[]).includes(statusRaw)
    ? statusRaw
    : "showroom";
  const location_label = formatBridalLocation({ rack, section, hanger }) || null;

  const { data, error } = await supabase
    .from("bridal_items")
    .insert({
      workspace_id: workspaceId,
      title: title.slice(0, 200),
      tag_code: str(flat, "tag_code"),
      kind,
      style_name: str(flat, "style_name"),
      size: str(flat, "size"),
      color: str(flat, "color"),
      designer: str(flat, "designer"),
      price: num(flat, "price"),
      status,
      rack,
      section,
      hanger,
      location_label,
    })
    .select("title, location_label")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "Could not log that item." };
  }
  return {
    ok: true,
    summary: `Logged ${data.title}${data.location_label ? ` at ${data.location_label}` : ""}. Tag codes are typed labels, not live RFID.`,
  };
}
