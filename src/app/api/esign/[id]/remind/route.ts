import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/esign/helpers";
import { sendSigningReminder } from "@/lib/esign/reminders";

/**
 * POST /api/esign/[id]/remind
 * Manually re-send the signing link to the signer. Allowed while the document
 * is awaiting signature (sent / viewed).
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

  // RLS-scoped read confirms access.
  const { data: doc, error } = await supabase
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!["sent", "viewed"].includes(doc.status)) {
    return NextResponse.json(
      { error: "Reminders can only be sent while a document is awaiting signature" },
      { status: 409 }
    );
  }
  if (!doc.signer_email) {
    return NextResponse.json({ error: "This document has no signer email" }, { status: 400 });
  }
  if (!doc.sign_token) {
    return NextResponse.json(
      { error: "This document has not been sent yet" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const result = await sendSigningReminder(admin, doc, getAppBaseUrl(req));

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to send reminder" },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
