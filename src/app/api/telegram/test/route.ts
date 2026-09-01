import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  TELEGRAM_PIPELINE_TEST_TEXT,
  sendTelegramAlert,
} from "@/lib/notify/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  const provided = auth?.replace(/^Bearer\s+/i, "") || key || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * GET/POST /api/telegram/test
 * Sends a one-shot Markdown ping via Bot API sendMessage.
 * Token and chat_id come from env only. Protected by CRON_SECRET.
 */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  const result = await sendTelegramAlert(TELEGRAM_PIPELINE_TEST_TEXT);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Send failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
