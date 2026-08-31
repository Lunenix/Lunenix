import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/submissions
 * List all form submissions for a workspace or specific form.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const formId = searchParams.get("formId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("form_submissions")
    .select(
      `
      *,
      form:forms(id, name),
      contact:contacts(*)
    `
    )
    .eq("workspace_id", workspaceId)
    .order("submitted_at", { ascending: false });

  // Filter by form if specified
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
