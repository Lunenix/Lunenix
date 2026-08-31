import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendServerEmail } from "@/lib/email/sendServerEmail";
import type { ScheduledEmailAttachment } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET/POST /api/emails/scheduled/run
 * Sends every scheduled email whose time has arrived (Vercel Cron).
 *
 * Protected by CRON_SECRET — Vercel Cron sends `Authorization: Bearer <secret>`
 * when the env var is set. Manual runs may pass the same header or ?key=.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    const provided = auth?.replace(/^Bearer\s+/i, "") || key;
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("scheduled_emails")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Scheduled email scan failed:", error);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of due || []) {
    const attachments = (row.attachments as ScheduledEmailAttachment[] | null) || [];
    const result = await sendServerEmail({
      workspaceId: row.workspace_id,
      to: row.to_email,
      toName: row.to_name,
      contactId: row.contact_id,
      templateId: row.template_id,
      subject: row.subject,
      html: row.body_html,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    if (result.success) {
      sent++;
      await admin
        .from("scheduled_emails")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
    } else {
      failed++;
      await admin
        .from("scheduled_emails")
        .update({ status: "failed", error: result.error || "Unknown error" })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ due: due?.length || 0, sent, failed });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
