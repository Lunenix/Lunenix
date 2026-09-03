import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { generateExcelBuffer } from "@/lib/export/excel";
import {
  CONTACT_EXCEL_COLUMNS,
  CONTACT_EXCEL_EXAMPLE,
  CONTACT_EXCEL_SHEET,
  type ContactExcelRow,
} from "@/lib/export/contactsExcel";
import type { Contact } from "@/types/database";

const MAX_ROWS = 5000;

function toExcelRow(row: Partial<Contact>): ContactExcelRow {
  return {
    type: typeof row.type === "string" ? row.type : "person",
    first_name: typeof row.first_name === "string" ? row.first_name : "",
    last_name: typeof row.last_name === "string" ? row.last_name : "",
    organization_name:
      typeof row.organization_name === "string" ? row.organization_name : "",
    email: typeof row.email === "string" ? row.email : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    address: typeof row.address === "string" ? row.address : "",
    notes: typeof row.notes === "string" ? row.notes : "",
    tags: Array.isArray(row.tags) ? row.tags.join(", ") : "",
  };
}

/**
 * GET /api/export?workspaceId=...&type=contacts
 * Optional template=1 returns a blank workbook with an example row.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "contacts").trim().toLowerCase();
  if (type !== "contacts") {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  const template = searchParams.get("template") === "1";
  let rows: ContactExcelRow[] = [CONTACT_EXCEL_EXAMPLE];

  if (!template) {
    const { data: contacts, error } = await auth.supabase
      .from("contacts")
      .select(
        "type, first_name, last_name, organization_name, email, phone, address, notes, tags"
      )
      .eq("workspace_id", auth.workspaceId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = (contacts ?? []).map((row: Partial<Contact>) => toExcelRow(row));
  }

  const fileBuffer = await generateExcelBuffer(
    CONTACT_EXCEL_SHEET,
    CONTACT_EXCEL_COLUMNS,
    rows
  );
  const filename = template ? "contacts-template.xlsx" : "contacts-export.xlsx";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
