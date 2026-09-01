import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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
    return {
      error: NextResponse.json(
        { error: "Forbidden: Access denied to workspace" },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, workspaceId: id };
}
