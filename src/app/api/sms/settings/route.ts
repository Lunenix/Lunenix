import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { toE164 } from "@/lib/sms";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("workspace_sms_settings")
    .select("workspace_id, from_e164, enabled, updated_at")
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    settings: data ?? {
      workspace_id: auth.workspaceId,
      from_e164: null,
      enabled: true,
      updated_at: null,
    },
    platform_configured: Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  let from: string | null = null;
  if (body.from_e164 !== undefined) {
    if (body.from_e164 === null || body.from_e164 === "") {
      from = null;
    } else {
      from = toE164(body.from_e164);
      if (!from) {
        return NextResponse.json(
          { error: "Enter a valid From number in E.164, like +15551234567." },
          { status: 400 }
        );
      }
    }
  }

  const enabled =
    typeof body.enabled === "boolean" ? body.enabled : undefined;

  const payload: Record<string, unknown> = {
    workspace_id: auth.workspaceId,
  };
  if (body.from_e164 !== undefined) payload.from_e164 = from;
  if (enabled !== undefined) payload.enabled = enabled;

  const { data, error } = await auth.supabase
    .from("workspace_sms_settings")
    .upsert(payload, { onConflict: "workspace_id" })
    .select("workspace_id, from_e164, enabled, updated_at")
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? "That From number is already used by another workspace."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
