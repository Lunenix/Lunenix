import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/esign/helpers";
import {
  sendSigningReminder,
  DEFAULT_REMINDER_INTERVAL_DAYS,
  DEFAULT_MAX_REMINDERS,
} from "@/lib/esign/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST /api/esign/reminders/run
 * Scheduled scan (Vercel Cron) that emails reminders for documents still
 * awaiting signature. Protected by CRON_SECRET — Vercel Cron automatically
 * sends `Authorization: Bearer <CRON_SECRET>` when the env var is set. Manual
 * runs may pass the same header or `?key=<CRON_SECRET>`.
 *
 * A document is due when it is sent/viewed, has reminders enabled, has fewer
 * than DEFAULT_MAX_REMINDERS sent, and its last activity (last reminder or
 * original send) is older than DEFAULT_REMINDER_INTERVAL_DAYS.
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
  const baseUrl = getAppBaseUrl(req);

  // Candidate documents awaiting signature with reminders enabled.
  const { data: docs, error } = await admin
    .from("esign_documents")
    .select(
      "id, workspace_id, name, status, sign_token, signer_name, signer_email, contact_id, reminder_count, reminders_enabled, last_reminder_at, sent_at"
    )
    .in("status", ["sent", "viewed"])
    .eq("reminders_enabled", true)
    .lt("reminder_count", DEFAULT_MAX_REMINDERS);

  if (error) {
    console.error("Reminder scan query failed:", error);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }

  const now = Date.now();
  const intervalMs = DEFAULT_REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

  const due = (docs || []).filter((d) => {
    if (!d.sign_token || !d.signer_email) return false;
    const last = d.last_reminder_at || d.sent_at;
    if (!last) return false;
    return now - new Date(last).getTime() >= intervalMs;
  });

  let sent = 0;
  const failures: string[] = [];
  for (const d of due) {
    const res = await sendSigningReminder(admin, d, baseUrl);
    if (res.success) sent += 1;
    else failures.push(`${d.id}: ${res.error || "unknown"}`);
  }

  return NextResponse.json({
    scanned: docs?.length || 0,
    due: due.length,
    sent,
    failures,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
