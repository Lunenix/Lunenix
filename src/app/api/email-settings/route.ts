import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailSettings } from "@/types/database";

/**
 * GET /api/email-settings?workspaceId=...
 * Fetch email settings for a workspace
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  const { data: settings, error } = await supabase
    .from("email_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching email settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: settings as EmailSettings | null });
}

/**
 * POST /api/email-settings
 * Create or update email settings for a workspace
 * Body: { workspace_id, from_email, from_name, reply_to? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, from_email, from_name, reply_to } = body;

  if (!workspace_id || !from_email || !from_name) {
    return NextResponse.json(
      { error: "workspace_id, from_email, and from_name are required" },
      { status: 400 }
    );
  }

  // Check if settings already exist
  const { data: existing } = await supabase
    .from("email_settings")
    .select("id")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  if (existing) {
    // Update existing settings
    const { data: settings, error } = await supabase
      .from("email_settings")
      .update({
        from_email,
        from_name,
        reply_to: reply_to || null,
      })
      .eq("workspace_id", workspace_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating email settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: settings as EmailSettings });
  } else {
    // Create new settings
    const { data: settings, error } = await supabase
      .from("email_settings")
      .insert({
        workspace_id,
        from_email,
        from_name,
        reply_to: reply_to || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating email settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: settings as EmailSettings }, { status: 201 });
  }
}
