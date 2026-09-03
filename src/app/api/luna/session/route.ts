import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import {
  getToolsForWorkspace,
  getVerticalPack,
} from "@/lib/verticals/registry";

/**
 * Luna workspace bootstrap. Avatar WebRTC is `/api/simli-session`.
 * Chat/tools run on `/api/luna/chat` via executeLunaTool.
 * Does not take userId from the body or use the service role.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gated = await requireSuperAdmin();
  if ("error" in gated) return gated.error;

  let workspaceId = "";
  try {
    const body = await req.json();
    workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  const { data: workspace } = await auth.supabase
    .from("workspaces")
    .select("id, name, industry_preset")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json(
      { error: "Invalid workspace context" },
      { status: 404 }
    );
  }

  const industryPreset =
    typeof workspace.industry_preset === "string"
      ? workspace.industry_preset
      : null;
  const pack = getVerticalPack(industryPreset);
  const packTools = getToolsForWorkspace([], industryPreset);

  return NextResponse.json({
    ok: true,
    workspaceName:
      typeof workspace.name === "string" ? workspace.name : null,
    industryPreset,
    packName: pack?.name ?? null,
    packToolNames: packTools.map((t) => t.name),
  });
}
