import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { generateExcelBuffer } from "@/lib/export/excel";
import { contactDisplayName, type Contact } from "@/types/database";

const EXPORT_TYPES = new Set(["contacts"]);
const MAX_ROWS = 5000;

type ContactExportRow = {
  name: string;
  email: string;
  company: string;
  type: string;
  created_at: string;
};

/**
 * GET /api/export?workspaceId=...&type=contacts
 * Membership-checked XLSX download. Uses real contact columns.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "contacts").trim().toLowerCase();
  if (!EXPORT_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  const { supabase, workspaceId } = auth;

  if (type === "contacts") {
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select(
        "type, first_name, last_name, organization_name, email, created_at"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: ContactExportRow[] = (contacts ?? []).map(
      (row: Partial<Contact>) => ({
        name: contactDisplayName({
          type: (row.type as Contact["type"]) ?? "person",
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          organization_name: row.organization_name ?? null,
          email: row.email ?? null,
        }),
        email: typeof row.email === "string" ? row.email : "",
        company:
          typeof row.organization_name === "string" ? row.organization_name : "",
        type: typeof row.type === "string" ? row.type : "",
        created_at:
          typeof row.created_at === "string" ? row.created_at : "",
      })
    );

    const fileBuffer = await generateExcelBuffer("Contacts", [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Company", key: "company", width: 25 },
      { header: "Type", key: "type", width: 15 },
      { header: "Created At", key: "created_at", width: 20 },
    ], rows);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="contacts-export.xlsx"',
      },
    });
  }

  return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
}
