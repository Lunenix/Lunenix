import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generateSignToken, getAppBaseUrl } from "@/lib/esign/helpers";
import { sendEsignEmail } from "@/lib/esign/sendEmail";

/**
 * POST /api/esign/[id]/send
 * Generate a signing token, mark the document as sent, and email the signer a
 * public signing link. Body may override { signer_name, signer_email }.
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

  const { data: doc, error } = await supabase
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!doc.original_file_path) {
    return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });
  }

  // Require at least one field before sending.
  const { count } = await supabase
    .from("esign_fields")
    .select("id", { count: "exact", head: true })
    .eq("document_id", id);
  if (!count || count === 0) {
    return NextResponse.json(
      { error: "Add at least one field before sending" },
      { status: 400 }
    );
  }

  const signerName = body.signer_name || doc.signer_name;
  const signerEmail = body.signer_email || doc.signer_email;
  if (!signerEmail) {
    return NextResponse.json({ error: "A signer email is required" }, { status: 400 });
  }

  const token = doc.sign_token || generateSignToken();

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("esign_documents")
    .update({
      status: "sent",
      sign_token: token,
      signer_name: signerName || null,
      signer_email: signerEmail,
      sent_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error updating document for send:", updateError);
    return NextResponse.json({ error: "Failed to send document" }, { status: 500 });
  }

  await admin.from("esign_events").insert({
    document_id: id,
    event_type: "sent",
    metadata: { to: signerEmail, by: user.email },
  });

  const signUrl = `${getAppBaseUrl(req)}/sign/${token}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
      <h2 style="color:#2d2d6e">You have a document to sign</h2>
      <p>${signerName ? `Hi ${signerName},` : "Hello,"}</p>
      <p>You've been requested to review and electronically sign
      <strong>${doc.name}</strong>.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${signUrl}" style="background:#2d2d6e;color:#fff;text-decoration:none;
        padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">
        Review &amp; Sign</a>
      </p>
      <p style="font-size:13px;color:#666">Or paste this link into your browser:<br>
      <a href="${signUrl}">${signUrl}</a></p>
      <hr style="border:none;border-top:1px solid #e5e5ef;margin:24px 0">
      <p style="font-size:12px;color:#999">Sent securely via Lunenix e-signature.</p>
    </div>`;

  const emailResult = await sendEsignEmail({
    workspaceId: doc.workspace_id,
    to: signerEmail,
    toName: signerName,
    contactId: doc.contact_id,
    subject: `Please sign: ${doc.name}`,
    html,
  });

  return NextResponse.json({
    success: true,
    sign_url: signUrl,
    email_sent: emailResult.success,
    email_error: emailResult.error || null,
  });
}
