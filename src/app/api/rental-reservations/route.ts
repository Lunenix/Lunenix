import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  PICKUP_METHODS,
  RATE_TYPES,
  RESERVATION_STATUSES,
} from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("rental_reservations")
    .select(
      "*, asset:rental_assets(id, name, daily_rate), contact:contacts(id, first_name, last_name, organization_name, type, email), logs:rental_condition_logs(*)"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("starts_on", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reservations: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const startsOn =
    typeof body.starts_on === "string" ? body.starts_on.slice(0, 10) : "";
  const endsOn =
    typeof body.ends_on === "string" ? body.ends_on.slice(0, 10) : "";
  if (!startsOn || !endsOn) {
    return NextResponse.json(
      { error: "starts_on and ends_on are required" },
      { status: 400 }
    );
  }
  const pickup_method = (PICKUP_METHODS as readonly string[]).includes(
    body.pickup_method
  )
    ? body.pickup_method
    : "pickup";
  const rate_type = (RATE_TYPES as readonly string[]).includes(body.rate_type)
    ? body.rate_type
    : "daily";
  const status = (RESERVATION_STATUSES as readonly string[]).includes(
    body.status
  )
    ? body.status
    : "hold";
  if (body.asset_id) {
    const { data: clashes } = await auth.supabase
      .from("rental_reservations")
      .select("id")
      .eq("workspace_id", auth.workspaceId)
      .eq("asset_id", body.asset_id)
      .in("status", ["hold", "reserved", "checked_out", "overdue"])
      .lte("starts_on", endsOn)
      .gte("ends_on", startsOn)
      .limit(1);
    if (clashes?.length) {
      return NextResponse.json(
        { error: "That asset is already booked for those dates." },
        { status: 409 }
      );
    }
  }
  const { data, error } = await auth.supabase
    .from("rental_reservations")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id: body.contact_id || null,
      asset_id: body.asset_id || null,
      estimate_id: body.estimate_id || null,
      starts_on: startsOn,
      ends_on: endsOn,
      pickup_method,
      job_site_address:
        typeof body.job_site_address === "string"
          ? body.job_site_address.trim() || null
          : null,
      status,
      rate_type,
      rate_amount: Number(body.rate_amount) || 0,
      deposit_amount: Number(body.deposit_amount) || 0,
      damage_waiver: body.damage_waiver === true,
      account_terms:
        typeof body.account_terms === "string"
          ? body.account_terms.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data.asset_id && (status === "hold" || status === "reserved")) {
    await auth.supabase
      .from("rental_assets")
      .update({ status: "reserved", updated_at: new Date().toISOString() })
      .eq("id", data.asset_id)
      .eq("workspace_id", auth.workspaceId);
  }
  return NextResponse.json({ reservation: data }, { status: 201 });
}
