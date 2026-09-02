import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("technician_profiles")
    .select("*")
    .eq("workspace_id", auth.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ technicians: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  const userId = body.user_id || auth.user.id;
  const { data, error } = await auth.supabase
    .from("technician_profiles")
    .upsert(
      {
        workspace_id: auth.workspaceId,
        user_id: userId,
        available: body.available !== false,
        certifications: body.certifications ?? null,
        license_expires: body.license_expires ?? null,
        eo_expires: body.eo_expires ?? null,
        ce_due_on: body.ce_due_on ?? null,
        notes: body.notes ?? null,
      },
      { onConflict: "workspace_id,user_id" }
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ technician: data }, { status: 201 });
}
