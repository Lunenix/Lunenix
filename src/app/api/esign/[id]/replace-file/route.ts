import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

/**
 * PUT /api/esign/[id]/replace-file
 * Replace the PDF of an existing e-sign document.
 * - Validates the new file is a PDF and counts pages.
 * - Upserts the file in storage at the same path.
 * - Resets the document to draft, clears signed_file_path, updates page_count.
 * - Deletes all existing field placements (positions won't match the new PDF).
 * Only allowed for documents that are NOT yet signed/countersigned.
 */
export async function PUT(
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

  // Load doc to verify ownership and current status.
  const { data: doc } = await supabase
    .from("esign_documents")
    .select("id, workspace_id, original_file_path, status")
    .eq("id", id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (["signed", "countersigned"].includes(doc.status)) {
    return NextResponse.json(
      { error: "Cannot replace the PDF of a signed or countersigned document." },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Validate PDF and get page count.
  let pageCount = 1;
  try {
    const pdf = await PDFDocument.load(bytes);
    pageCount = pdf.getPageCount();
  } catch {
    return NextResponse.json(
      { error: "The file is not a valid PDF" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const path = `${doc.workspace_id}/${doc.id}/original.pdf`;

  // Upsert (replaces the existing file at the same storage path).
  const { error: uploadError } = await admin.storage
    .from("contracts")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    console.error("Error uploading replacement PDF:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload PDF" },
      { status: 500 }
    );
  }

  // Update document: new page count, clear signed file, reset to draft.
  await admin
    .from("esign_documents")
    .update({
      original_file_path: path,
      page_count: pageCount,
      signed_file_path: null,
      status: "draft",
    })
    .eq("id", id);

  // Clear all field placements — they were positioned on the old PDF.
  await admin.from("esign_fields").delete().eq("document_id", id);

  // Audit trail.
  await admin.from("esign_events").insert({
    document_id: id,
    event_type: "created",
    metadata: { action: "file_replaced", by: user.email, new_page_count: pageCount },
  });

  return NextResponse.json({ success: true, pageCount });
}
