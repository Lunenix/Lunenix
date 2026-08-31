import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { syncWorkspaceInbox } from "@/lib/email/imapSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET/POST /api/emails/inbound/run
 * Scheduled inbound-email sync (Vercel Cron). Loops over every workspace that
 * has IMAP enabled and pulls new messages into the in-app inbox.
 *
 * Protected by CRON_SECRET — Vercel Cron automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when the env var is set. Manual runs
 * may pass the same header or `?key=<CRON_SECRET>`.
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

  const { data: rows, error } = await admin
    .from("email_settings")
    .select("workspace_id")
    .eq("imap_enabled", true);

  if (error) {
    console.error("Inbound sync scan query failed:", error);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }

  let imported = 0;
  const failures: string[] = [];
  for (const row of rows || []) {
    const res = await syncWorkspaceInbox(row.workspace_id);
    if (res.success) imported += res.imported;
    else failures.push(`${row.workspace_id}: ${res.error || "unknown"}`);
  }

  return NextResponse.json({
    workspaces: rows?.length || 0,
    imported,
    failures,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
