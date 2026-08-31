import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { EsignField } from "@/types/database";

/**
 * POST /api/esign/[id]/clone
 * Duplicate a document into a NEW draft (default type: sub_agreement). Copies
 * the source PDF and all field placements, but resets values, signatures,
 * status, and the signing token so it can be sent fresh.
 *
 * Body (optional): { name?: string, type?: 'contract'|'sub_agreement' }
 */
export async function POST(
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
  const body = await req.json().catch(() => ({}));

  // RLS-scoped read confirms access.
  const { data: source, error } = await supabase
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !source) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!source.original_file_path) {
    return NextResponse.json(
      { error: "The source document has no PDF to copy" },
      { status: 400 }
    );
  }

  const newType: "contract" | "sub_agreement" =
    body.type === "contract" ? "contract" : "sub_agreement";
  const newName: string =
    (body.name && String(body.name).trim()) || `${source.name} (Sub-Agreement)`;

  const admin = createAdminClient();

  // Create the new document row.
  const { data: newDoc, error: insertError } = await admin
    .from("esign_documents")
    .insert({
      workspace_id: source.workspace_id,
      name: newName,
      type: newType,
      status: "draft",
      page_count: source.page_count,
      project_id: source.project_id,
      contact_id: source.contact_id,
      assigned_workflow_id: source.assigned_workflow_id,
      signer_name: source.signer_name,
      signer_email: source.signer_email,
      cloned_from: source.id,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError || !newDoc) {
    console.error("Error creating cloned document:", insertError);
    const msg = insertError?.message?.includes("uniq_esign_primary_contract_per_project")
      ? "This project already has a primary contract. Clone it as a Sub-Agreement instead."
      : "Failed to clone document";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Copy the source PDF into the new document's storage path.
  const { data: fileData, error: downloadError } = await admin.storage
    .from("contracts")
    .download(source.original_file_path);
  if (downloadError || !fileData) {
    console.error("Error downloading source PDF for clone:", downloadError);
    await admin.from("esign_documents").delete().eq("id", newDoc.id);
    return NextResponse.json({ error: "Failed to copy the source PDF" }, { status: 500 });
  }
  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const newPath = `${source.workspace_id}/${newDoc.id}/original.pdf`;
  const { error: uploadError } = await admin.storage
    .from("contracts")
    .upload(newPath, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    console.error("Error uploading cloned PDF:", uploadError);
    await admin.from("esign_documents").delete().eq("id", newDoc.id);
    return NextResponse.json({ error: "Failed to copy the source PDF" }, { status: 500 });
  }
  await admin
    .from("esign_documents")
    .update({ original_file_path: newPath })
    .eq("id", newDoc.id);

  // Copy field placements (reset values so signers fill them fresh).
  const { data: srcFields } = await admin
    .from("esign_fields")
    .select("*")
    .eq("document_id", source.id)
    .order("created_at");
  const fields = (srcFields || []) as EsignField[];
  if (fields.length > 0) {
    const rows = fields.map((f) => ({
      document_id: newDoc.id,
      page: f.page,
      field_type: f.field_type,
      pos_x: f.pos_x,
      pos_y: f.pos_y,
      width: f.width,
      height: f.height,
      assigned_to: f.assigned_to,
      required: f.required,
      placeholder: f.placeholder,
      value: null,
    }));
    await admin.from("esign_fields").insert(rows);
  }

  await admin.from("esign_events").insert({
    document_id: newDoc.id,
    event_type: "created",
    metadata: { cloned_from: source.id, by: user.email },
  });

  return NextResponse.json(
    { document: { ...newDoc, original_file_path: newPath } },
    { status: 201 }
  );
}
