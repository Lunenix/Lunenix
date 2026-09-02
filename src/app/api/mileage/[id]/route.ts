import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { mileageAmount } from "@/lib/fieldService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("mileage_logs", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const { data: current } = await authed.supabase
    .from("mileage_logs")
    .select("miles, rate_per_mile")
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  for (const key of [
    "project_id",
    "contact_id",
    "driven_on",
    "origin",
    "destination",
    "purpose",
    "notes",
  ]) {
    if (key in body) update[key] = body[key] || null;
  }
  const miles = "miles" in body ? Number(body.miles) : Number(current.miles);
  const rate =
    "rate_per_mile" in body
      ? Number(body.rate_per_mile)
      : Number(current.rate_per_mile);
  if ("miles" in body || "rate_per_mile" in body) {
    if (!miles || miles <= 0) {
      return NextResponse.json(
        { error: "miles must be greater than 0" },
        { status: 400 }
      );
    }
    update.miles = miles;
    update.rate_per_mile = rate;
    update.amount = mileageAmount(miles, rate);
  }

  const { data, error } = await authed.supabase
    .from("mileage_logs")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("mileage_logs", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("mileage_logs")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
