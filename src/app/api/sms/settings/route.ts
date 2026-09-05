import { NextResponse, type NextRequest } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { bindWorkspaceTelnyxNumber } from "@/lib/sms-persist";
import { telnyxConfigured } from "@/lib/telnyx";

export async function GET(request: NextRequest) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { data } = await auth.supabase
    .from("workspace_sms_settings")
    .select("from_e164, enabled, area_code, provision_error")
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  return NextResponse.json({
    platform_configured: telnyxConfigured(),
    from_e164: data?.from_e164 ?? null,
    enabled: data?.enabled ?? true,
    area_code: data?.area_code ?? null,
    provision_error: data?.provision_error ?? null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;

  const { data: ws } = await auth.supabase
    .from("workspaces")
    .select("phone")
    .eq("id", auth.workspaceId)
    .maybeSingle();
  const phone = typeof ws?.phone === "string" ? ws.phone : "";
  if (!phone) {
    return NextResponse.json(
      { error: "This workspace needs a company phone so we can match an area code." },
      { status: 400 }
    );
  }
  const result = await bindWorkspaceTelnyxNumber(
    auth.supabase,
    auth.workspaceId,
    phone
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, from_e164: result.from_e164 });
}
