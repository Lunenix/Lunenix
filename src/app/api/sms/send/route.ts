import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { SMS_BODY_MAX, toE164 } from "@/lib/sms";
import { sendWorkspaceSms } from "@/lib/sms-persist";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  const text =
    typeof body.body === "string" ? body.body.trim().slice(0, SMS_BODY_MAX) : "";
  if (!text) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  let to: string | null = toE164(body.to);
  let contactId: string | null =
    typeof body.contact_id === "string" ? body.contact_id : null;

  if (typeof body.thread_id === "string" && body.thread_id) {
    const { data: thread } = await auth.supabase
      .from("sms_threads")
      .select("id, contact_phone, contact_id")
      .eq("id", body.thread_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    to = thread.contact_phone;
    contactId = thread.contact_id ?? contactId;
  }

  if (contactId && !to) {
    const { data: contact } = await auth.supabase
      .from("contacts")
      .select("id, phone")
      .eq("id", contactId)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!contact) {
      return NextResponse.json(
        { error: "That contact is not in this workspace." },
        { status: 400 }
      );
    }
    to = contact.phone;
  }

  if (!to) {
    return NextResponse.json(
      { error: "Pick a contact with a phone number, or an existing thread." },
      { status: 400 }
    );
  }

  const sent = await sendWorkspaceSms(auth.supabase, {
    workspaceId: auth.workspaceId,
    to,
    body: text,
    contactId,
  });
  if ("error" in sent) {
    return NextResponse.json({ error: sent.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, summary: sent.summary });
}
