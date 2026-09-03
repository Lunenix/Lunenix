import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { executeLunaTool } from "@/lib/luna-server";
import { getVerticalPack } from "@/lib/verticals/registry";

/**
 * Direct pack/CRM tool run for Luna. Same dispatcher as chat (`executeLunaTool`).
 * Super-admin session only. Does not take userId from the body or use the service role.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gated = await requireSuperAdmin();
  if ("error" in gated) return gated.error;

  let workspaceId = "";
  let toolName = "";
  let toolArgs: Record<string, unknown> = {};
  try {
    const body = await req.json();
    workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";
    toolName = typeof body?.toolName === "string" ? body.toolName.trim() : "";
    if (
      body?.toolArgs &&
      typeof body.toolArgs === "object" &&
      !Array.isArray(body.toolArgs)
    ) {
      toolArgs = body.toolArgs as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!toolName) {
    return NextResponse.json({ error: "toolName is required" }, { status: 400 });
  }

  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  const { data: workspace } = await auth.supabase
    .from("workspaces")
    .select("id, industry_preset")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json(
      { error: "Unauthorized workspace access" },
      { status: 401 }
    );
  }

  const pack = getVerticalPack(
    typeof workspace.industry_preset === "string"
      ? workspace.industry_preset
      : null
  );
  const packToolNames = new Set((pack?.tools ?? []).map((t) => t.name));
  const isPackTool =
    packToolNames.has(toolName) || toolName.startsWith("bartending_");
  if (isPackTool && !packToolNames.has(toolName)) {
    return NextResponse.json(
      {
        error:
          "That vertical tool is not registered for this workspace industry.",
      },
      { status: 400 }
    );
  }

  const result = await executeLunaTool(
    auth.supabase,
    auth.workspaceId,
    auth.user.id,
    toolName,
    toolArgs
  );
  return NextResponse.json(result);
}
