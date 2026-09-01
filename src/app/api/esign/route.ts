import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/esign?workspaceId=...
 * List e-signature documents for a workspace.
 */
export async function GET(req: NextRequest) {
  const access = await verifyWorkspaceAccess(req);
  if (access.errorResponse) return access.errorResponse;

  const { data, error } = await access.supabase
    .from("esign_documents")
    .select(
      `*, contact:contacts(*), project:projects(id, name), assigned_workflow:automation_workflows(id, name)`
    )
    .eq("workspace_id", access.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching esign documents:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }

  return NextResponse.json({ documents: data || [] });
}

/**
 * POST /api/esign
 * Create a new e-signature document by uploading a PDF or Word document (multipart/form-data).
 * - PDFs: stored directly, not editable
 * - .docx: converted to editable HTML content using mammoth
 * Fields: file, name, workspace_id, type?, project_id?, contact_id?,
 * assigned_workflow_id?, signer_name?, signer_email?
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const workspace_id = form.get("workspace_id") as string | null;
  const name = (form.get("name") as string | null)?.trim();
  const type = (form.get("type") as string | null) || "contract";

  if (!file || !workspace_id || !name) {
    return NextResponse.json(
      { error: "file, workspace_id, and name are required" },
      { status: 400 }
    );
  }

  const isPdf = file.type === "application/pdf";
  const isDocx =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx");

  if (!isPdf && !isDocx) {
    return NextResponse.json(
      { error: "Only PDF and Word (.docx) files are supported" },
      { status: 400 }
    );
  }

  // Verify workspace membership.
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let pageCount = 1;
  let htmlContent: string | null = null;
  let contentType: "uploaded_pdf" | "editable_document" = "uploaded_pdf";

  if (isPdf) {
    // PDF: validate and count pages.
    try {
      const pdf = await PDFDocument.load(bytes);
      pageCount = pdf.getPageCount();
    } catch {
      return NextResponse.json(
        { error: "The file is not a valid PDF" },
        { status: 400 }
      );
    }
  } else {
    // .docx: convert to editable HTML.
    contentType = "editable_document";
    try {
      const result = await mammoth.convertToHtml({ buffer: Buffer.from(arrayBuffer) });
      htmlContent = result.value;
      // Rough page count estimate: 1 page ~= 500 words of HTML.
      pageCount = Math.max(1, Math.ceil(htmlContent.length / 2500));
    } catch (e) {
      console.error("Error converting .docx to HTML:", e);
      return NextResponse.json(
        { error: "The file is not a valid Word document" },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();

  // Insert the document first to obtain an id for the storage path.
  const { data: doc, error: insertError } = await admin
    .from("esign_documents")
    .insert({
      workspace_id,
      name,
      type: type === "sub_agreement" ? "sub_agreement" : "contract",
      status: "draft",
      page_count: pageCount,
      content: htmlContent,
      content_type: contentType,
      project_id: (form.get("project_id") as string) || null,
      contact_id: (form.get("contact_id") as string) || null,
      assigned_workflow_id: (form.get("assigned_workflow_id") as string) || null,
      signer_name: (form.get("signer_name") as string) || null,
      signer_email: (form.get("signer_email") as string) || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError || !doc) {
    console.error("Error creating esign document:", insertError);
    const msg = insertError?.message?.includes("uniq_esign_primary_contract_per_project")
      ? "This project already has a primary contract. Choose Sub-Agreement instead."
      : "Failed to create document";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Only upload PDF files to storage. For .docx, we'll generate PDF on demand.
  let path: string | null = null;
  if (isPdf) {
    path = `${workspace_id}/${doc.id}/original.pdf`;
    const { error: uploadError } = await admin.storage
      .from("contracts")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      await admin.from("esign_documents").delete().eq("id", doc.id);
      return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
    }
  }

  // Generate contract number atomically.
  const currentYear = new Date().getFullYear();
  const { data: contractNumberResult } = await admin.rpc("generate_contract_number", {
    p_workspace_id: workspace_id,
    p_year: currentYear,
  });
  const contractNumber = contractNumberResult as string;

  await admin
    .from("esign_documents")
    .update({ original_file_path: path, contract_number: contractNumber })
    .eq("id", doc.id);

  await admin.from("esign_events").insert({
    document_id: doc.id,
    event_type: "created",
    metadata: {
      by: user.email,
      file_type: isPdf ? "pdf" : "docx",
      editable: contentType === "editable_document",
    },
  });

  return NextResponse.json(
    {
      document: {
        ...doc,
        original_file_path: path,
        contract_number: contractNumber,
        content: htmlContent,
        content_type: contentType,
      },
    },
    { status: 201 }
  );
}
