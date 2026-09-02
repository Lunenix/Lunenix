import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/superAdmin";
import { ensureSuperAdminMembership } from "@/lib/supabase/grantSuperAdminWorkspaces";

type Authed = {
  supabase: ReturnType<typeof createClient>;
  user: User;
  workspaceId: string;
};

/**
 * Auth + tenant check for API routes.
 * 401 if unsigned-in, 400 if workspace id missing, 403 if not a member.
 */
export async function requireWorkspaceMember(
  workspaceId: string | null | undefined
): Promise<Authed | { error: NextResponse }> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const id = typeof workspaceId === "string" ? workspaceId.trim() : "";
  if (!id) {
    return {
      error: NextResponse.json(
        { error: "workspaceId parameter is required" },
        { status: 400 }
      ),
    };
  }

  const { data: membership, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (memberError || !membership) {
    if (isSuperAdmin(user)) {
      try {
        await ensureSuperAdminMembership(createAdminClient(), user.id, id);
      } catch (e) {
        console.error("ensureSuperAdminMembership failed:", e);
        return {
          error: NextResponse.json(
            { error: "Forbidden: Access denied to workspace" },
            { status: 403 }
          ),
        };
      }
      return { supabase, user, workspaceId: id };
    }
    return {
      error: NextResponse.json(
        { error: "Forbidden: Access denied to workspace" },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, workspaceId: id };
}

export type WorkspaceAuthed = Authed;

/**
 * Auth + membership for GET routes that pass ?workspaceId=...
 * Failures set `errorResponse`; success has supabase, user, workspaceId.
 */
export async function verifyWorkspaceAccess(
  request: Request
): Promise<(Authed & { errorResponse?: undefined }) | { errorResponse: NextResponse }> {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const result = await requireWorkspaceMember(workspaceId);
  if ("error" in result) {
    return { errorResponse: result.error };
  }
  return result;
}
