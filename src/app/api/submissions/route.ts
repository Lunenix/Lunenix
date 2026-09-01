import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/submissions
 * List all form submissions for a workspace or specific form.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const formId = new URL(request.url).searchParams.get("formId");

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

  return NextResponse.json({ submissions: submissions ?? [] });
}
