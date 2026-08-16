import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/esign/[id]
 * Fetch a document with fields, signatures, events, and a signed URL for the
 * source PDF (and the signed PDF if it exists).
 */
export async function GET(
  req: NextRequest,
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

  const { data: doc, error } = await supabase
    .from("esign_documents")
    .select(
      `*, contact:contacts(*), project:projects(id, name), assigned_workflow:automation_workflows(id, name)`
    )
    .eq("id", id)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const [{ data: fields }, { data: signatures }, { data: events }] =
    await Promise.all([
      supabase.from("esign_fields").select("*").eq("document_id", id).order("created_at"),
      supabase.from("esign_signatures").select("*").eq("document_id", id).order("signed_at"),
      supabase.from("esign_events").select("*").eq("document_id", id).order("created_at"),
    ]);

  // Signed URLs for viewing the PDFs in the editor.
  const admin = createAdminClient();
  let fileUrl: string | null = null;
  let signedUrl: string | null = null;
  if (doc.original_file_path) {
    const { data } = await admin.storage
      .from("contracts")
      .createSignedUrl(doc.original_file_path, 3600);
    fileUrl = data?.signedUrl || null;
  }
  if (doc.signed_file_path) {
    const { data } = await admin.storage
      .from("contracts")
      .createSignedUrl(doc.signed_file_path, 3600);
    signedUrl = data?.signedUrl || null;
  }

  return NextResponse.json({
    document: {
      ...doc,
      fields: fields || [],
      signatures: signatures || [],
      events: events || [],
    },
    fileUrl,
    signedUrl,
  });
}

/**
 * PATCH /api/esign/[id]
 * Update document metadata (name, type, project, contact, assigned workflow,
 * signer details). Only allowed while the document has not been signed.
 */
export async function PATCH(
  req: NextRequest,
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
  const body = await req.json();

  const allowed: Record<string, unknown> = {};
  for (const key of [
    "name",
    "type",
    "project_id",
    "contact_id",
    "assigned_workflow_id",
    "signer_name",
    "signer_email",
  ]) {
    if (key in body) allowed[key] = body[key] || null;
  }

  const { data, error } = await supabase
    .from("esign_documents")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const msg = error.message?.includes("uniq_esign_primary_contract_per_project")
      ? "This project already has a primary contract. Choose Sub-Agreement instead."
      : "Failed to update document";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ document: data });
}

/**
 * DELETE /api/esign/[id]
 * Delete a document and its stored files.
 */
export async function DELETE(
  req: NextRequest,
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

  const { data: doc } = await supabase
    .from("esign_documents")
    .select("id, original_file_path, signed_file_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("esign_documents").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }

  if (doc) {
    const admin = createAdminClient();
    const paths = [doc.original_file_path, doc.signed_file_path].filter(
      Boolean
    ) as string[];
    if (paths.length) {
      await admin.storage.from("contracts").remove(paths);
    }
  }

  return NextResponse.json({ success: true });
}
