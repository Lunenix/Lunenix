import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SYSTEM_TEMPLATES } from "@/lib/email/systemTemplates";

/**
 * POST /api/email-templates/seed
 * Idempotently seed the system default templates for a workspace.
 * Only inserts templates whose template_key isn't already present, so it
 * never overwrites a user's edits to an existing default.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspace_id } = await request.json();
  if (!workspace_id) {
    return NextResponse.json(
      { error: "workspace_id is required" },
      { status: 400 }
    );
  }

  // Which system keys already exist for this workspace?
  const { data: existing, error: fetchErr } = await supabase
    .from("email_templates")
    .select("template_key")
    .eq("workspace_id", workspace_id)
    .not("template_key", "is", null);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const existingKeys = new Set((existing || []).map((r) => r.template_key));
  const toInsert = SYSTEM_TEMPLATES.filter(
    (t) => !existingKeys.has(t.template_key)
  ).map((t) => ({
    workspace_id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    variables: [],
    is_system_default: true,
    template_key: t.template_key,
  }));

  if (toInsert.length === 0) {
    return NextResponse.json({ seeded: 0 });
  }

  const { error: insertErr } = await supabase
    .from("email_templates")
    .insert(toInsert);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ seeded: toInsert.length });
}
