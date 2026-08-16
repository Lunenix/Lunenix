import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getUserAgent, getAppBaseUrl } from "@/lib/esign/helpers";
import { sendEsignEmail } from "@/lib/esign/sendEmail";
import { generateSignedPdf, type StampField } from "@/lib/esign/generatePdf";
import {
  executeWorkflowsForTrigger,
  executeWorkflowById,
} from "@/lib/automation/executeWorkflow";
import type { EsignField } from "@/types/database";

/**
 * GET /api/sign/[token]
 * Public (no auth). Returns the document + fields + a signed URL to the source
 * PDF so the signer can review and sign. Marks the document as viewed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const admin = createAdminClient();
  const { token } = await params;

  const { data: doc, error } = await admin
    .from("esign_documents")
    .select("*")
    .eq("sign_token", token)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status === "void") {
    return NextResponse.json({ error: "This document has been voided" }, { status: 410 });
  }

  const { data: fields } = await admin
    .from("esign_fields")
    .select("*")
    .eq("document_id", doc.id)
    .order("created_at");

  // Signed URL for the source PDF.
  let fileUrl: string | null = null;
  if (doc.original_file_path) {
    const { data } = await admin.storage
      .from("contracts")
      .createSignedUrl(doc.original_file_path, 3600);
    fileUrl = data?.signedUrl || null;
  }

  const alreadySigned = ["signed", "countersigned"].includes(doc.status);
  let signedUrl: string | null = null;
  if (alreadySigned && doc.signed_file_path) {
    const { data } = await admin.storage
      .from("contracts")
      .createSignedUrl(doc.signed_file_path, 3600);
    signedUrl = data?.signedUrl || null;
  }

  // Mark viewed (first view only).
  if (doc.status === "sent") {
    await admin
      .from("esign_documents")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", doc.id);
    await admin.from("esign_events").insert({
      document_id: doc.id,
      event_type: "viewed",
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
    });
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      status: doc.status,
      page_count: doc.page_count,
      signer_name: doc.signer_name,
      signer_email: doc.signer_email,
    },
    fields: fields || [],
    fileUrl,
    signedUrl,
    alreadySigned,
  });
}

/**
 * POST /api/sign/[token]
 * Public (no auth). Submits field values + signature, generates the signed
 * PDF, records the audit trail, emails the signed copy, and fires the
 * contract_signed automation trigger.
 *
 * Body: {
 *   field_values: { [fieldId]: string },
 *   signature: { type: 'typed'|'drawn', data: string },
 *   signer_name: string, signer_email?: string
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const admin = createAdminClient();
  const { token } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: doc, error } = await admin
    .from("esign_documents")
    .select("*")
    .eq("sign_token", token)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status === "void") {
    return NextResponse.json({ error: "This document has been voided" }, { status: 410 });
  }
  if (["signed", "countersigned"].includes(doc.status)) {
    return NextResponse.json({ error: "This document has already been signed" }, { status: 409 });
  }
  if (!doc.original_file_path) {
    return NextResponse.json({ error: "Document has no source file" }, { status: 400 });
  }

  const fieldValues: Record<string, string> = body.field_values || {};
  const signature = body.signature as { type: "typed" | "drawn"; data: string } | undefined;
  const signerName: string = (body.signer_name || doc.signer_name || "").trim();
  const signerEmail: string | null = body.signer_email || doc.signer_email || null;

  if (!signerName) {
    return NextResponse.json({ error: "Your full name is required" }, { status: 400 });
  }
  if (!signature || !signature.data) {
    return NextResponse.json({ error: "A signature is required" }, { status: 400 });
  }

  // Load fields.
  const { data: fieldRows } = await admin
    .from("esign_fields")
    .select("*")
    .eq("document_id", doc.id)
    .order("created_at");
  const fields = (fieldRows || []) as EsignField[];

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Resolve the effective value for each field and validate required ones.
  const missing: string[] = [];
  const stampFields: StampField[] = [];

  for (const f of fields) {
    let value: string | null = fieldValues[f.id] ?? f.value ?? null;
    let sigData: string | null = null;
    let sigType: "typed" | "drawn" | null = null;

    if (f.assigned_to === "client") {
      if (f.field_type === "signature" || f.field_type === "initials") {
        sigData = signature.data;
        sigType = signature.type;
        if (f.field_type === "initials" && signature.type === "typed") {
          // Derive initials from the typed name.
          sigData = signerName
            .split(/\s+/)
            .map((p) => p[0]?.toUpperCase() || "")
            .join("");
        }
      } else if (f.field_type === "name") {
        value = value || signerName;
      } else if (f.field_type === "date") {
        value = value || todayStr;
      }
    }

    // Required validation (client-assigned only; owner fields handled at countersign).
    if (f.required && f.assigned_to === "client") {
      const hasSig =
        (f.field_type === "signature" || f.field_type === "initials") && !!sigData;
      const hasVal = !!value;
      if (!hasSig && !hasVal) missing.push(f.field_type);
    }

    stampFields.push({
      page: f.page,
      field_type: f.field_type,
      pos_x: f.pos_x,
      pos_y: f.pos_y,
      width: f.width,
      height: f.height,
      value,
      signature_data: sigData,
      signature_type: sigType,
    });
  }

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Please complete all required fields (${missing.join(", ")})` },
      { status: 400 }
    );
  }

  // Download the source PDF.
  const { data: fileData, error: downloadError } = await admin.storage
    .from("contracts")
    .download(doc.original_file_path);
  if (downloadError || !fileData) {
    console.error("Error downloading source PDF:", downloadError);
    return NextResponse.json({ error: "Could not load the document" }, { status: 500 });
  }
  const originalBytes = new Uint8Array(await fileData.arrayBuffer());

  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const signedAtIso = new Date().toISOString();

  // Generate the signed PDF with an audit page.
  let signedBytes: Uint8Array;
  try {
    signedBytes = await generateSignedPdf(originalBytes, stampFields, {
      documentName: doc.name,
      documentId: doc.id,
      signerName,
      signerEmail,
      ipAddress: ip,
      userAgent: ua,
      signedAt: signedAtIso,
      sentAt: doc.sent_at,
      viewedAt: doc.viewed_at,
    });
  } catch (e) {
    console.error("Error generating signed PDF:", e);
    return NextResponse.json({ error: "Failed to generate signed document" }, { status: 500 });
  }

  // Store the signed PDF (immutable artifact).
  const signedPath = `${doc.workspace_id}/${doc.id}/signed.pdf`;
  const { error: uploadError } = await admin.storage
    .from("contracts")
    .upload(signedPath, signedBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    console.error("Error uploading signed PDF:", uploadError);
    return NextResponse.json({ error: "Failed to store signed document" }, { status: 500 });
  }

  // Persist field values.
  for (const f of fields) {
    const v = fieldValues[f.id];
    if (v !== undefined) {
      await admin.from("esign_fields").update({ value: v }).eq("id", f.id);
    }
  }

  // Record the signature (immutable).
  await admin.from("esign_signatures").insert({
    document_id: doc.id,
    signer_name: signerName,
    signer_email: signerEmail,
    signature_type: signature.type,
    signature_data: signature.data,
    role: "client",
    ip_address: ip,
    user_agent: ua,
    signed_at: signedAtIso,
  });

  // Update document.
  await admin
    .from("esign_documents")
    .update({
      status: "signed",
      signed_at: signedAtIso,
      signed_file_path: signedPath,
      signer_name: signerName,
      signer_email: signerEmail,
    })
    .eq("id", doc.id);

  await admin.from("esign_events").insert({
    document_id: doc.id,
    event_type: "signed",
    ip_address: ip,
    user_agent: ua,
    metadata: { signer_name: signerName, signer_email: signerEmail },
  });

  // Email the signed copy to the signer (and notify the creator).
  const base64Signed = Buffer.from(signedBytes).toString("base64");
  const downloadNote = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
      <h2 style="color:#2d2d6e">Your signed copy of ${doc.name}</h2>
      <p>Thank you, ${signerName}. Your signed document is attached as a PDF for your records.</p>
      <p style="font-size:12px;color:#999">Signed ${new Date(signedAtIso).toUTCString()} via Lunenix e-signature.</p>
    </div>`;

  if (signerEmail) {
    await sendEsignEmail({
      workspaceId: doc.workspace_id,
      to: signerEmail,
      toName: signerName,
      contactId: doc.contact_id,
      subject: `Signed: ${doc.name}`,
      html: downloadNote,
      attachments: [{ filename: `${doc.name}-signed.pdf`, content: base64Signed }],
    });
  }

  // Notify the document creator, if we can resolve their email.
  if (doc.created_by) {
    try {
      const { data: creator } = await admin.auth.admin.getUserById(doc.created_by);
      const creatorEmail = creator?.user?.email;
      if (creatorEmail && creatorEmail !== signerEmail) {
        await sendEsignEmail({
          workspaceId: doc.workspace_id,
          to: creatorEmail,
          subject: `${signerName} signed ${doc.name}`,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
              <h2 style="color:#2d2d6e">${doc.name} has been signed</h2>
              <p><strong>${signerName}</strong>${signerEmail ? ` (${signerEmail})` : ""} signed the document.</p>
              <p>A copy is attached. You can also view it in Lunenix.</p>
            </div>`,
          attachments: [{ filename: `${doc.name}-signed.pdf`, content: base64Signed }],
        });
      }
    } catch (e) {
      console.error("Could not notify creator:", e);
    }
  }

  // Fire the contract_signed automation trigger (and assigned workflow).
  executeWorkflowsForTrigger(
    "contract_signed",
    {
      document_id: doc.id,
      contract_id: doc.id,
      contact_id: doc.contact_id,
      project_id: doc.project_id,
      assigned_workflow_id: doc.assigned_workflow_id,
      signer_name: signerName,
      signer_email: signerEmail,
    },
    doc.workspace_id
  ).catch((err) => console.error("Error firing contract_signed workflows:", err));

  // Also start the explicitly assigned workflow (any trigger type).
  if (doc.assigned_workflow_id) {
    executeWorkflowById(doc.assigned_workflow_id, {
      document_id: doc.id,
      contract_id: doc.id,
      contact_id: doc.contact_id,
      project_id: doc.project_id,
      signer_name: signerName,
      signer_email: signerEmail,
      workspace_id: doc.workspace_id,
    }).catch((err) => console.error("Error firing assigned workflow:", err));
  }

  const signUrl = `${getAppBaseUrl(req)}/sign/${token}`;
  return NextResponse.json({ success: true, sign_url: signUrl });
}
