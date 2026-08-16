import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PUT /api/esign/[id]/content
 * Save edited HTML content for an editable document.
 * Only allowed for documents with content_type='editable_document'.
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
  const { content } = await req.json();

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "content must be a string" },
      { status: 400 }
    );
  }

  // Verify document exists and is editable.
  const { data: doc } = await supabase
    .from("esign_documents")
    .select("id, content_type")
    .eq("id", id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.content_type !== "editable_document") {
    return NextResponse.json(
      { error: "Only editable documents can have their content updated" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Update the content.
  const { error } = await admin
    .from("esign_documents")
    .update({ content })
    .eq("id", id);

  if (error) {
    console.error("Error updating document content:", error);
    return NextResponse.json(
      { error: "Failed to update content" },
      { status: 500 }
    );
  }

  // Audit trail.
  await admin.from("esign_events").insert({
    document_id: id,
    event_type: "created",
    metadata: { action: "content_edited", by: user.email },
  });

  return NextResponse.json({ success: true });
}
