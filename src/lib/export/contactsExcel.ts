import "server-only";

import ExcelJS from "exceljs";
import type { ContactType } from "@/types/database";

export const CONTACT_EXCEL_SHEET = "Contacts";
export const CONTACT_IMPORT_MAX_ROWS = 2000;
export const CONTACT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export type ContactExcelRow = {
  type: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  tags: string;
};

export const CONTACT_EXCEL_COLUMNS: {
  header: string;
  key: keyof ContactExcelRow;
  width: number;
}[] = [
  { header: "type", key: "type", width: 16 },
  { header: "first_name", key: "first_name", width: 18 },
  { header: "last_name", key: "last_name", width: 18 },
  { header: "organization_name", key: "organization_name", width: 24 },
  { header: "email", key: "email", width: 28 },
  { header: "phone", key: "phone", width: 16 },
  { header: "address", key: "address", width: 32 },
  { header: "notes", key: "notes", width: 32 },
  { header: "tags", key: "tags", width: 20 },
];

export const CONTACT_EXCEL_EXAMPLE: ContactExcelRow = {
  type: "person",
  first_name: "Ada",
  last_name: "Lovelace",
  organization_name: "Analytical Engines",
  email: "ada@example.com",
  phone: "555-0100",
  address: "123 Computing Lane",
  notes: "Preferred contact",
  tags: "vip, referral",
};

const HEADER_ALIASES: Record<string, keyof ContactExcelRow> = {
  type: "type",
  contact_type: "type",
  first_name: "first_name",
  firstname: "first_name",
  first: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  last: "last_name",
  organization_name: "organization_name",
  organization: "organization_name",
  company: "organization_name",
  company_name: "organization_name",
  email: "email",
  phone: "phone",
  telephone: "phone",
  mobile: "phone",
  address: "address",
  notes: "notes",
  note: "notes",
  tags: "tags",
  tag: "tags",
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cellText(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    const rec = value as { text?: unknown; richText?: { text?: string }[]; result?: unknown; hyperlink?: string };
    if (typeof rec.text === "string") return rec.text.trim();
    if (Array.isArray(rec.richText)) {
      return rec.richText.map((p) => p.text ?? "").join("").trim();
    }
    if (typeof rec.hyperlink === "string") return rec.hyperlink.trim();
    if (rec.result != null) return cellText(rec.result);
  }
  return String(value).trim();
}

export function parseContactType(raw: string): ContactType {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (t === "organization" || t === "org" || t === "company") return "organization";
  if (t === "lead") return "lead";
  return "person";
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export type ParsedContactImport = {
  type: ContactType;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
};

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t ? t.slice(0, 2000) : null;
}

export function isImportableContact(row: ParsedContactImport): boolean {
  if (row.type === "organization") return Boolean(row.organization_name);
  return Boolean(
    row.first_name || row.last_name || row.organization_name || row.email
  );
}

export async function parseContactsWorkbook(
  buffer: ArrayBuffer
): Promise<{ rows: ParsedContactImport[]; error?: string }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { rows: [], error: "Could not read that Excel file. Use .xlsx." };
  }
  const sheet =
    workbook.getWorksheet(CONTACT_EXCEL_SHEET) ?? workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], error: "The workbook has no sheets." };
  }

  const headerRow = sheet.getRow(1);
  const colMap = new Map<number, keyof ContactExcelRow>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = HEADER_ALIASES[normalizeHeader(cellText(cell.value))];
    if (key) colMap.set(colNumber, key);
  });
  if (colMap.size === 0) {
    return {
      rows: [],
      error:
        "No contact columns found. Use type, first_name, last_name, organization_name, email, phone, address, notes, tags.",
    };
  }

  const rows: ParsedContactImport[] = [];
  const max = Math.min(sheet.rowCount, CONTACT_IMPORT_MAX_ROWS + 1);
  for (let r = 2; r <= max; r++) {
    const excelRow = sheet.getRow(r);
    const raw: ContactExcelRow = {
      type: "",
      first_name: "",
      last_name: "",
      organization_name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      tags: "",
    };
    let any = false;
    Array.from(colMap.entries()).forEach(([col, key]) => {
      const text = cellText(excelRow.getCell(col).value);
      if (text) any = true;
      raw[key] = text;
    });
    if (!any) continue;
    const parsed: ParsedContactImport = {
      type: parseContactType(raw.type),
      first_name: emptyToNull(raw.first_name),
      last_name: emptyToNull(raw.last_name),
      organization_name: emptyToNull(raw.organization_name),
      email: emptyToNull(raw.email)?.toLowerCase() ?? null,
      phone: emptyToNull(raw.phone),
      address: emptyToNull(raw.address),
      notes: emptyToNull(raw.notes),
      tags: parseTags(raw.tags),
    };
    if (!isImportableContact(parsed)) continue;
    rows.push(parsed);
  }

  return { rows };
}
