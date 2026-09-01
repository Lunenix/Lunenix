import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";

/**
 * GET /api/submissions
 * List all form submissions for a workspace or specific form.
 */
export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const formId = req.nextUrl.searchParams.get("formId");
  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  let query = auth.supabase
    .from("form_submissions")
    .select(
      `
      *,
      form:forms(id, name),
      contact:contacts(*)
    `
    )
    .eq("workspace_id", auth.workspaceId)
    .order("submitted_at", { ascending: false });

  if (formId) {
    query = query.eq("form_id", formId);
  }

  const { data: submissions, error } = await query;

  if (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }

  return NextResponse.json({ submissions: submissions || [] });
}
