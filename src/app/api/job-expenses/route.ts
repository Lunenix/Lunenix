import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { createAdminClient } from "@/lib/supabase/server";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { data, error } = await auth.supabase
    .from("job_expenses")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("incurred_on", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data ?? [] });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const workspaceId = String(form.get("workspace_id") ?? "");
    const auth = await requireWorkspaceMember(workspaceId);
    if ("error" in auth) return auth.error;
    const amount = Number(form.get("amount"));
    if (!amount) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }
    let receiptUrl: string | null = null;
    const file = form.get("receipt");
    if (file instanceof File && file.size > 0) {
      const ext = TYPES[file.type];
      if (!ext) {
        return NextResponse.json(
          { error: "Receipt must be an image or PDF" },
          { status: 400 }
        );
      }
      const admin = createAdminClient();
      const path = `${auth.workspaceId}/receipts/${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("workspace-assets")
        .upload(path, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type,
        });
      if (!upErr) {
        receiptUrl = admin.storage.from("workspace-assets").getPublicUrl(path)
          .data.publicUrl;
      }
    }
    const { data, error } = await auth.supabase
      .from("job_expenses")
      .insert({
        workspace_id: auth.workspaceId,
        project_id: String(form.get("project_id") ?? "") || null,
        contact_id: String(form.get("contact_id") ?? "") || null,
        category: String(form.get("category") ?? "parts"),
        amount,
        vendor: String(form.get("vendor") ?? "").trim() || null,
        receipt_url: receiptUrl,
        notes: String(form.get("notes") ?? "").trim() || null,
        incurred_on:
          String(form.get("incurred_on") ?? "") ||
          new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ expense: data }, { status: 201 });
  }

  const body = await request.json();
  const auth = await requireWorkspaceMember(body.workspace_id);
  if ("error" in auth) return auth.error;
  if (!body.amount) {
    return NextResponse.json({ error: "amount is required" }, { status: 400 });
  }
  const { data, error } = await auth.supabase
    .from("job_expenses")
    .insert({
      workspace_id: auth.workspaceId,
      project_id: body.project_id ?? null,
      contact_id: body.contact_id ?? null,
      category: body.category || "parts",
      amount: Number(body.amount),
      vendor: body.vendor ?? null,
      notes: body.notes ?? null,
      incurred_on: body.incurred_on ?? new Date().toISOString().slice(0, 10),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data }, { status: 201 });
}
