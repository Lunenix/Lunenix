import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateDueServicePlanVisits } from "@/lib/field/generateServicePlanVisits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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

async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }
  try {
    const result = await generateDueServicePlanVisits(createAdminClient());
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generate failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
