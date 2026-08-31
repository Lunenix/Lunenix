import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { EsignFieldInput } from "@/types/database";

/**
 * PUT /api/esign/[id]/fields
 * Replace all fields for a document (called when saving the editor layout).
 * Body: { fields: EsignFieldInput[] }
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
  const body = await req.json();
  const fields = (body.fields || []) as EsignFieldInput[];

  // Ensure the document exists and is editable (RLS also enforces workspace).
  const { data: doc } = await supabase
    .from("esign_documents")
    .select("id, status")
    .eq("id", id)
    .single();
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (["signed", "countersigned", "void"].includes(doc.status)) {
    return NextResponse.json(
      { error: "This document can no longer be edited" },
      { status: 400 }
    );
  }

  // Replace: delete existing, insert new.
  await supabase.from("esign_fields").delete().eq("document_id", id);

  if (fields.length > 0) {
    const rows = fields.map((f) => ({
      document_id: id,
      page: f.page ?? 0,
      field_type: f.field_type,
      pos_x: f.pos_x,
      pos_y: f.pos_y,
      width: f.width,
      height: f.height,
      assigned_to: f.assigned_to || "client",
      required: f.required ?? true,
      placeholder: f.placeholder || null,
      value: f.value || null,
    }));
    const { error } = await supabase.from("esign_fields").insert(rows);
    if (error) {
      console.error("Error saving fields:", error);
      return NextResponse.json({ error: "Failed to save fields" }, { status: 500 });
    }
  }

  const { data: saved } = await supabase
    .from("esign_fields")
    .select("*")
    .eq("document_id", id)
    .order("created_at");

  return NextResponse.json({ fields: saved || [] });
}
