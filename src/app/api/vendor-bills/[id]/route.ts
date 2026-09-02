import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("vendor_bills", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of ["vendor_name", "amount", "due_date", "notes", "status"]) {
    if (key in body) update[key] = body[key];
  }
  if (update.status === "paid" && !body.paid_at) {
    update.paid_at = new Date().toISOString();
  }
  if (update.status === "pending") update.paid_at = null;
  const { data, error } = await authed.supabase
    .from("vendor_bills")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bill: data });
}
