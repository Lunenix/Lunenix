import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { isScheduleStatus } from "@/lib/hubSchedule";

const SELECT =
  "*, contact:contacts(id, type, first_name, last_name, organization_name, email, phone)";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("schedule_events", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string") update.title = body.title.trim().slice(0, 200);
  if (typeof body.starts_at === "string") {
    update.starts_at = new Date(body.starts_at).toISOString();
  }
  if (typeof body.ends_at === "string" || body.ends_at === null) {
    update.ends_at = body.ends_at
      ? new Date(body.ends_at).toISOString()
      : null;
  }
  if (typeof body.location === "string" || body.location === null) {
    update.location = body.location?.trim?.().slice(0, 200) || null;
  }
  if (typeof body.notes === "string" || body.notes === null) {
    update.notes = body.notes?.trim?.().slice(0, 4000) || null;
  }
  if (typeof body.status === "string") {
    if (!isScheduleStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    update.status = body.status;
  }
  if ("contact_id" in body) {
    const contactId = body.contact_id || null;
    if (contactId) {
      const { data: client } = await supabase
        .from("contacts")
        .select("id")
        .eq("id", contactId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!client?.id) {
        return NextResponse.json(
          { error: "That contact is not in this workspace." },
          { status: 400 }
        );
      }
    }
    update.contact_id = contactId;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("schedule_events")
    .update(update)
    .eq("id", recordId)
    .eq("workspace_id", workspaceId)
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ event: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("schedule_events", params.id);
  if ("error" in authed) return authed.error;
  const { supabase, workspaceId, recordId } = authed;
  const { error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", recordId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
