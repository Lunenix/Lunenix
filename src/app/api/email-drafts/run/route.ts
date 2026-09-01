import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendServerEmail } from "@/lib/email/sendServerEmail";
import type { EmailDraft } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  const provided = auth?.replace(/^Bearer\s+/i, "") || key || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\r\n|\r|\n/g, "<br/>");
}

/**
 * GET/POST /api/email-drafts/run
 * Sends `email_drafts` whose status is scheduled and scheduled_at has passed.
 * Cookie user clients cannot see other tenants' drafts; this uses the service
 * role. Protected by CRON_SECRET (Authorization Bearer or ?key=).
 */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: pendingEmails, error } = await admin
    .from("email_drafts")
    .select(
      "id, workspace_id, recipient_email, subject, body_text, status, scheduled_at"
    )
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Scheduled email draft scan failed:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }

  const dispatchedIds: string[] = [];
  let failed = 0;

  for (const email of (pendingEmails as EmailDraft[] | null) || []) {
    const result = await sendServerEmail({
      workspaceId: email.workspace_id,
      to: email.recipient_email,
      subject: email.subject,
      html: textToHtml(email.body_text || ""),
    });

    if (result.success) {
      const { error: updateError } = await admin
        .from("email_drafts")
        .update({ status: "sent" })
        .eq("id", email.id)
        .eq("workspace_id", email.workspace_id)
        .eq("status", "scheduled");

      if (updateError) {
        failed++;
        continue;
      }

      try {
        await admin.from("activity_logs").insert({
          workspace_id: email.workspace_id,
          actor_type: "user",
          action: "send_email",
          description: `Scheduled email sent to ${email.recipient_email.slice(0, 120)}`,
        });
      } catch {
        /* activity_logs may be missing until 0018 is applied */
      }

      dispatchedIds.push(email.id);
    } else {
      failed++;
      await admin
        .from("email_drafts")
        .update({ status: "failed" })
        .eq("id", email.id)
        .eq("workspace_id", email.workspace_id)
        .eq("status", "scheduled");
    }
  }

  return NextResponse.json({
    processed: dispatchedIds.length,
    failed,
    ids: dispatchedIds,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
