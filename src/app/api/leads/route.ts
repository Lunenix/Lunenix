import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/leads
 * Creates a lead in a pipeline stage.
 * Body: { workspace_id, pipeline_id, stage_id, title, value?, notes?, contact_id?, expected_close_date? }
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, pipeline_id, stage_id, title } = body;
  if (!workspace_id || !pipeline_id || !stage_id || !title) {
    return NextResponse.json(
      { error: "workspace_id, pipeline_id, stage_id and title are required" },
      { status: 400 }
    );
  }

  // Determine next position within the stage.
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", stage_id);

  const payload = {
    workspace_id,
    pipeline_id,
    stage_id,
    title,
    value: body.value ?? null,
    currency: body.currency ?? "USD",
    notes: body.notes ?? null,
    contact_id: body.contact_id ?? null,
    expected_close_date: body.expected_close_date ?? null,
    position: count ?? 0,
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select("*, contact:contacts(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ lead: data }, { status: 201 });
}
