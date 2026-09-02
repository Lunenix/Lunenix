import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import {
  CONDITION_KINDS,
  PICKUP_METHODS,
  RATE_TYPES,
  RESERVATION_STATUSES,
  lateFeeAmount,
} from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("rental_reservations", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const action = typeof body.action === "string" ? body.action : "";

  const { data: current } = await authed.supabase
    .from("rental_reservations")
    .select("*, asset:rental_assets(id, daily_rate)")
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  for (const key of [
    "contact_id",
    "asset_id",
    "starts_on",
    "ends_on",
    "job_site_address",
    "rate_amount",
    "deposit_amount",
    "damage_charge",
    "account_terms",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if (
    typeof body.pickup_method === "string" &&
    (PICKUP_METHODS as readonly string[]).includes(body.pickup_method)
  ) {
    update.pickup_method = body.pickup_method;
  }
  if (
    typeof body.rate_type === "string" &&
    (RATE_TYPES as readonly string[]).includes(body.rate_type)
  ) {
    update.rate_type = body.rate_type;
  }
  if ("damage_waiver" in body) update.damage_waiver = body.damage_waiver === true;
  if (
    typeof body.status === "string" &&
    (RESERVATION_STATUSES as readonly string[]).includes(body.status)
  ) {
    update.status = body.status;
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const assetId = (update.asset_id as string | null) ?? current.asset_id;
  const daily =
    Number(
      (current.asset as { daily_rate?: number } | null)?.daily_rate ??
        current.rate_amount
    ) || 0;

  if (action === "checkout") {
    update.status = "checked_out";
    update.checked_out_on = now;
    const kind = (CONDITION_KINDS as readonly string[]).includes(body.kind)
      ? body.kind
      : "checkout";
    await authed.supabase.from("rental_condition_logs").insert({
      workspace_id: authed.workspaceId,
      reservation_id: authed.recordId,
      asset_id: assetId,
      kind,
      photo_url:
        typeof body.photo_url === "string"
          ? body.photo_url.trim() || null
          : null,
      fuel_level:
        typeof body.fuel_level === "string"
          ? body.fuel_level.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      logged_on: today,
    });
    if (assetId) {
      const assetUpdate: Record<string, unknown> = {
        status: "out",
        location: "out",
        updated_at: now,
      };
      if (typeof body.fuel_level === "string") {
        assetUpdate.fuel_level = body.fuel_level.trim() || null;
      }
      await authed.supabase
        .from("rental_assets")
        .update(assetUpdate)
        .eq("id", assetId)
        .eq("workspace_id", authed.workspaceId);
    }
  }

  if (action === "checkin") {
    const returnedOn = today;
    update.status = "returned";
    update.returned_on = now;
    update.late_fee = lateFeeAmount(String(current.ends_on), returnedOn, daily);
    if ("damage_charge" in body) {
      update.damage_charge = Number(body.damage_charge) || 0;
    }
    await authed.supabase.from("rental_condition_logs").insert({
      workspace_id: authed.workspaceId,
      reservation_id: authed.recordId,
      asset_id: assetId,
      kind: "checkin",
      photo_url:
        typeof body.photo_url === "string"
          ? body.photo_url.trim() || null
          : null,
      fuel_level:
        typeof body.fuel_level === "string"
          ? body.fuel_level.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      logged_on: returnedOn,
    });
    if (assetId) {
      const damaged = Number(body.damage_charge) > 0;
      const assetUpdate: Record<string, unknown> = {
        status: damaged ? "maintenance" : "available",
        location: damaged ? "in_repair" : "yard",
        updated_at: now,
      };
      if (typeof body.fuel_level === "string") {
        assetUpdate.fuel_level = body.fuel_level.trim() || null;
      }
      await authed.supabase
        .from("rental_assets")
        .update(assetUpdate)
        .eq("id", assetId)
        .eq("workspace_id", authed.workspaceId);
    }
  }

  update.updated_at = now;
  const { data, error } = await authed.supabase
    .from("rental_reservations")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select(
      "*, asset:rental_assets(id, name, daily_rate), contact:contacts(id, first_name, last_name, organization_name, type, email), logs:rental_condition_logs(*)"
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reservation: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("rental_reservations", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("rental_reservations")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
