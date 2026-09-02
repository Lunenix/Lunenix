import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import {
  ASSET_CATEGORIES,
  ASSET_LOCATIONS,
  ASSET_STATUSES,
} from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("rental_assets", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of [
    "name",
    "sku",
    "purchase_cost",
    "purchased_on",
    "hours_used",
    "service_interval_hours",
    "last_serviced_on",
    "next_service_on",
    "fuel_level",
    "last_known_location",
    "notes",
    "hourly_rate",
    "daily_rate",
    "weekly_rate",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.category === "string" &&
    (ASSET_CATEGORIES as readonly string[]).includes(body.category)
  ) {
    update.category = body.category;
  }
  if (
    typeof body.location === "string" &&
    (ASSET_LOCATIONS as readonly string[]).includes(body.location)
  ) {
    update.location = body.location;
  }
  if (
    typeof body.status === "string" &&
    (ASSET_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await authed.supabase
    .from("rental_assets")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("rental_assets", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("rental_assets")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
