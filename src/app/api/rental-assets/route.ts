import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  ASSET_CATEGORIES,
  ASSET_LOCATIONS,
  ASSET_STATUSES,
} from "@/lib/fieldService";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("rental_assets")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const category = (ASSET_CATEGORIES as readonly string[]).includes(body.category)
    ? body.category
    : "other";
  const location = (ASSET_LOCATIONS as readonly string[]).includes(body.location)
    ? body.location
    : "yard";
  const status = (ASSET_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "available";
  const { data, error } = await auth.supabase
    .from("rental_assets")
    .insert({
      workspace_id: auth.workspaceId,
      name,
      sku: typeof body.sku === "string" ? body.sku.trim() || null : null,
      category,
      location,
      status,
      hourly_rate: Number(body.hourly_rate) || 0,
      daily_rate: Number(body.daily_rate) || 0,
      weekly_rate: Number(body.weekly_rate) || 0,
      purchase_cost:
        body.purchase_cost === "" || body.purchase_cost == null
          ? null
          : Number(body.purchase_cost),
      hours_used: Number(body.hours_used) || 0,
      next_service_on: body.next_service_on || null,
      fuel_level:
        typeof body.fuel_level === "string"
          ? body.fuel_level.trim() || null
          : null,
      last_known_location:
        typeof body.last_known_location === "string"
          ? body.last_known_location.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data }, { status: 201 });
}
