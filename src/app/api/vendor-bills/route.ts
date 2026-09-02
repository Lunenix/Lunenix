import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("vendor_bills")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bills: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  if (!body.vendor_name || body.amount == null) {
    return NextResponse.json(
      { error: "vendor_name and amount are required" },
      { status: 400 }
    );
  }
  const { data, error } = await auth.supabase
    .from("vendor_bills")
    .insert({
      workspace_id: auth.workspaceId,
      vendor_name: String(body.vendor_name).trim(),
      amount: Number(body.amount),
      due_date: body.due_date ?? null,
      status: body.status === "paid" ? "paid" : "pending",
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bill: data }, { status: 201 });
}
