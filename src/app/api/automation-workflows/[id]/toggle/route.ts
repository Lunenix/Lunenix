import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AutomationWorkflow } from "@/types/database";

/**
 * POST /api/automation-workflows/[id]/toggle
 * Toggle the is_active status of an automation workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // First, get the current workflow to check its current active state
  const { data: currentWorkflow, error: fetchError } = await supabase
    .from("automation_workflows")
    .select("is_active")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("Error fetching workflow:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Toggle the is_active state
  const { data: workflow, error } = await supabase
    .from("automation_workflows")
    .update({ is_active: !currentWorkflow.is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error toggling workflow:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflow: workflow as AutomationWorkflow });
}
