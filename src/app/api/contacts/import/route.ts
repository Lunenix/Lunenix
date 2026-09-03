import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import {
  CONTACT_IMPORT_MAX_BYTES,
  parseContactsWorkbook,
} from "@/lib/export/contactsExcel";

/**
 * POST /api/contacts/import
 * Multipart: workspace_id + file (.xlsx). Upserts by email in this workspace.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const workspaceId = String(form.get("workspace_id") ?? "");
  const auth = await requireWorkspaceMember(workspaceId);
  if ("error" in auth) return auth.error;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > CONTACT_IMPORT_MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 5 MB)." },
      { status: 400 }
    );
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Upload an .xlsx Excel file." },
      { status: 400 }
    );
  }

  const parsed = await parseContactsWorkbook(await file.arrayBuffer());
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "No contact rows found in that file." },
      { status: 400 }
    );
  }

  const { data: existing, error: listError } = await auth.supabase
    .from("contacts")
    .select("id, email")
    .eq("workspace_id", auth.workspaceId)
    .is("archived_at", null)
    .not("email", "is", null);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const byEmail = new Map<string, string>();
  for (const row of existing ?? []) {
    const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
    if (email && !byEmail.has(email)) byEmail.set(email, row.id);
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of parsed.rows) {
    const payload = {
      workspace_id: auth.workspaceId,
      type: row.type,
      first_name: row.first_name,
      last_name: row.last_name,
      organization_name: row.organization_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      tags: row.tags,
    };
    const matchId = row.email ? byEmail.get(row.email) : undefined;
    if (matchId) {
      const { error } = await auth.supabase
        .from("contacts")
        .update(payload)
        .eq("id", matchId)
        .eq("workspace_id", auth.workspaceId);
      if (error) {
        errors.push(error.message);
        continue;
      }
      updated += 1;
    } else {
      const { data, error } = await auth.supabase
        .from("contacts")
        .insert(payload)
        .select("id, email")
        .single();
      if (error) {
        errors.push(error.message);
        continue;
      }
      created += 1;
      if (data?.email) {
        byEmail.set(String(data.email).toLowerCase(), data.id);
      }
    }
  }

  return NextResponse.json({
    created,
    updated,
    skipped: parsed.rows.length - created - updated,
    errors: errors.slice(0, 8),
  });
}
