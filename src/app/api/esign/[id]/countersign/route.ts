import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getUserAgent } from "@/lib/esign/helpers";
import { sendEsignEmail } from "@/lib/esign/sendEmail";
import { generateSignedPdf, type StampField } from "@/lib/esign/generatePdf";
import type { EsignField, EsignSignature } from "@/types/database";

/**
 * POST /api/esign/[id]/countersign
 * Authenticated owner countersigns a client-signed document. Re-stamps the
 * ORIGINAL PDF with BOTH the client's and the owner's fields, appends a
 * two-party audit page, and moves the document to `countersigned`.
 *
 * Body: {
 *   field_values: { [fieldId]: string },   // owner-assigned fields
 *   signature: { type: 'typed'|'drawn', data: string },
 *   signer_name?: string, signer_email?: string
 * }
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
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // RLS-scoped read confirms the user can access this workspace document.
  const { data: doc, error } = await supabase
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status !== "signed") {
    return NextResponse.json(
      { error: "Only client-signed documents can be countersigned" },
      { status: 409 }
    );
  }
  if (!doc.original_file_path) {
    return NextResponse.json({ error: "Document has no source file" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: fieldRows } = await admin
    .from("esign_fields")
    .select("*")
    .eq("document_id", id)
    .order("created_at");
  const fields = (fieldRows || []) as EsignField[];

  const ownerFields = fields.filter((f) => f.assigned_to === "owner");
  if (ownerFields.length === 0) {
    return NextResponse.json(
      { error: "This document has no owner fields to countersign" },
      { status: 400 }
    );
  }

  // The owner's adopted signature.
  const signature = body.signature as
    | { type: "typed" | "drawn"; data: string }
    | undefined;
  if (!signature || !signature.data) {
    return NextResponse.json({ error: "A signature is required" }, { status: 400 });
  }

  // Resolve owner identity.
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const ownerName: string =
    (body.signer_name || (profile && profile.full_name) || user.email || "Owner").trim();
  const ownerEmail: string | null = body.signer_email || user.email || null;

  // The original client signature (for re-stamping the client's sig fields).
  const { data: sigRows } = await admin
    .from("esign_signatures")
    .select("*")
    .eq("document_id", id)
    .order("signed_at");
  const signatures = (sigRows || []) as EsignSignature[];
  const clientSig = signatures.find((s) => s.role === "client") || null;

  const ownerValues: Record<string, string> = body.field_values || {};
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const deriveInitials = (name: string) =>
    name
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("");

  const missing: string[] = [];
  const stampFields: StampField[] = [];
  const resolvedOwnerValues: Record<string, string> = {};

  for (const f of fields) {
    const isSig = f.field_type === "signature" || f.field_type === "initials";
    let value: string | null = f.value ?? null;
    let sigData: string | null = null;
    let sigType: "typed" | "drawn" | null = null;

    if (f.assigned_to === "client") {
      // Reproduce the client's signing exactly.
      if (isSig && clientSig) {
        sigType = clientSig.signature_type;
        if (f.field_type === "initials" && clientSig.signature_type === "typed") {
          sigData = deriveInitials(clientSig.signer_name);
        } else {
          sigData = clientSig.signature_data;
        }
      }
      // Non-signature client fields already have their resolved value in f.value.
    } else {
      // Owner field — fill from this countersign submission.
      if (isSig) {
        sigType = signature.type;
        if (f.field_type === "initials" && signature.type === "typed") {
          sigData = deriveInitials(ownerName);
        } else {
          sigData = signature.data;
        }
      } else if (f.field_type === "name") {
        value = ownerValues[f.id] || ownerName;
      } else if (f.field_type === "date") {
        value = ownerValues[f.id] || todayStr;
      } else {
        value = ownerValues[f.id] ?? value;
      }
      if (!isSig && value) resolvedOwnerValues[f.id] = value;

      if (f.required) {
        const ok = isSig ? !!sigData : !!value;
        if (!ok) missing.push(f.field_type);
      }
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

  // Download the ORIGINAL PDF and re-stamp everything from scratch.
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
  const countersignedAtIso = new Date().toISOString();

  let signedBytes: Uint8Array;
  try {
    signedBytes = await generateSignedPdf(originalBytes, stampFields, {
      documentName: doc.name,
      documentId: doc.id,
      signers: [
        {
          role: "client",
          name: clientSig?.signer_name || doc.signer_name || "Client",
          email: clientSig?.signer_email || doc.signer_email,
          ipAddress: clientSig?.ip_address,
          userAgent: clientSig?.user_agent,
          signedAt: clientSig?.signed_at || doc.signed_at || countersignedAtIso,
        },
        {
          role: "owner",
          name: ownerName,
          email: ownerEmail,
          ipAddress: ip,
          userAgent: ua,
          signedAt: countersignedAtIso,
        },
      ],
      sentAt: doc.sent_at,
      viewedAt: doc.viewed_at,
    });
  } catch (e) {
    console.error("Error generating countersigned PDF:", e);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }

  const signedPath = `${doc.workspace_id}/${doc.id}/signed.pdf`;
  const { error: uploadError } = await admin.storage
    .from("contracts")
    .upload(signedPath, signedBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    console.error("Error uploading countersigned PDF:", uploadError);
    return NextResponse.json({ error: "Failed to store document" }, { status: 500 });
  }

  // Persist resolved owner values.
  for (const [fieldId, v] of Object.entries(resolvedOwnerValues)) {
    await admin.from("esign_fields").update({ value: v }).eq("id", fieldId);
  }

  await admin.from("esign_signatures").insert({
    document_id: doc.id,
    signer_name: ownerName,
    signer_email: ownerEmail,
    signature_type: signature.type,
    signature_data: signature.data,
    role: "owner",
    ip_address: ip,
    user_agent: ua,
    signed_at: countersignedAtIso,
  });

  await admin
    .from("esign_documents")
    .update({
      status: "countersigned",
      signed_file_path: signedPath,
      countersigned_at: countersignedAtIso,
    })
    .eq("id", doc.id);

  await admin.from("esign_events").insert({
    document_id: doc.id,
    event_type: "countersigned",
    ip_address: ip,
    user_agent: ua,
    metadata: { owner_name: ownerName, owner_email: ownerEmail },
  });

  // Email the fully-executed copy to both parties.
  const base64Signed = Buffer.from(signedBytes).toString("base64");
  const recipients = new Set<string>();
  if (doc.signer_email) recipients.add(doc.signer_email);
  if (ownerEmail) recipients.add(ownerEmail);
  for (const to of Array.from(recipients)) {
    await sendEsignEmail({
      workspaceId: doc.workspace_id,
      to,
      subject: `Fully executed: ${doc.name}`,
      contactId: to === doc.signer_email ? doc.contact_id : null,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
          <h2 style="color:#2d2d6e">${doc.name} is fully executed</h2>
          <p>This document has now been signed by all parties. The final signed
          copy is attached for your records.</p>
          <p style="font-size:12px;color:#999">Countersigned ${new Date(
            countersignedAtIso
          ).toUTCString()} via Lunenix e-signature.</p>
        </div>`,
      attachments: [{ filename: `${doc.name}-executed.pdf`, content: base64Signed }],
    });
  }

  return NextResponse.json({ success: true });
}
