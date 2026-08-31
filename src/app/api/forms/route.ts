import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/forms
 * List all forms for a workspace.
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

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  // Fetch forms for the workspace
  const { data: forms, error } = await supabase
    .from("forms")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching forms:", error);
    return NextResponse.json(
      { error: "Failed to fetch forms" },
      { status: 500 }
    );
  }

  return NextResponse.json({ forms: forms || [] });
}

/**
 * POST /api/forms
 * Create a new form.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    workspace_id,
    name,
    description,
    status,
    fields,
    submit_button_text,
    success_message,
    allow_multiple_submissions,
  } = body;

  if (!workspace_id || !name) {
    return NextResponse.json(
      { error: "workspace_id and name are required" },
      { status: 400 }
    );
  }

  const { data: form, error } = await supabase
    .from("forms")
    .insert({
      workspace_id,
      name,
      description: description || null,
      status: status || "draft",
      fields: fields || [],
      submit_button_text: submit_button_text || "Submit",
      success_message: success_message || "Thank you for your submission!",
      allow_multiple_submissions:
        allow_multiple_submissions !== undefined
          ? allow_multiple_submissions
          : true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating form:", error);
    return NextResponse.json(
      { error: "Failed to create form" },
      { status: 500 }
    );
  }

  return NextResponse.json({ form }, { status: 201 });
}
