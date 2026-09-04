import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { isScheduleStatus } from "@/lib/hubSchedule";

const SELECT =
  "*, contact:contacts(id, type, first_name, last_name, organization_name, email, phone)";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { supabase, workspaceId } = auth;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("schedule_events")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .order("starts_at", { ascending: true })
    .limit(400);

  if (from) query = query.gte("starts_at", from);
  if (to) query = query.lte("starts_at", to);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const startsAt = typeof body.starts_at === "string" ? body.starts_at : "";
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) {
    return NextResponse.json({ error: "starts_at is required" }, { status: 400 });
  }

  let contactId: string | null = body.contact_id ?? null;
  if (contactId) {
    const { data: client } = await auth.supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!client?.id) {
      return NextResponse.json(
        { error: "That contact is not in this workspace." },
        { status: 400 }
      );
    }
  }

  const statusRaw = typeof body.status === "string" ? body.status : "scheduled";
  const status = isScheduleStatus(statusRaw) ? statusRaw : "scheduled";

  let endsAt: string | null =
    typeof body.ends_at === "string" && body.ends_at ? body.ends_at : null;
  if (!endsAt) {
    const minutes =
      typeof body.duration_minutes === "number" && body.duration_minutes > 0
        ? body.duration_minutes
        : 60;
    endsAt = new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString();
  }

  const { data, error } = await auth.supabase
    .from("schedule_events")
    .insert({
      workspace_id: auth.workspaceId,
      contact_id: contactId,
      title,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt,
      location:
        typeof body.location === "string" ? body.location.trim().slice(0, 200) || null : null,
      notes:
        typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) || null : null,
      status,
    })
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ event: data }, { status: 201 });
}
