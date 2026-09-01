import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceLineItem } from "@/types/database";

export type EditableInvoicePdfData = {
  invoice_number: string;
  client_name: string;
  total: number;
  due_date: string;
  notes?: string | null;
  payment_terms?: string | null;
  currency?: string;
  line_items?: InvoiceLineItem[];
};

type AliasInput = EditableInvoicePdfData & {
  invoiceNumber?: string;
  clientName?: string;
  amount?: number;
  dueDate?: string;
};

function clip(value: string, max: number): string {
  return value.slice(0, max);
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalize(data: AliasInput): EditableInvoicePdfData {
  return {
    invoice_number: clip(
      asText(data.invoice_number) || asText(data.invoiceNumber),
      40
    ),
    client_name: clip(
      asText(data.client_name) || asText(data.clientName),
      200
    ),
    total: asMoney(data.total ?? data.amount),
    due_date: clip(asText(data.due_date) || asText(data.dueDate), 40),
    notes: data.notes ?? null,
    payment_terms: data.payment_terms ?? null,
    currency: asText(data.currency) || "USD",
    line_items: Array.isArray(data.line_items) ? data.line_items.slice(0, 8) : [],
  };
}

/**
 * Builds a one-page invoice PDF with AcroForm fields for client, total, and notes.
 * Uses invoice `total` (not a non-existent `amount` column).
 */
export async function createEditableInvoicePDF(
  raw: AliasInput
): Promise<Buffer> {
  const data = normalize(raw);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const form = pdfDoc.getForm();
  const ink = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.4, 0.4, 0.4);

  page.drawText(`INVOICE: #${data.invoice_number || "Draft"}`, {
    x: 50,
    y: 730,
    size: 20,
    font,
    color: ink,
  });

  page.drawText(`Due Date: ${data.due_date || "—"}`, {
    x: 50,
    y: 700,
    size: 12,
    font,
    color: muted,
  });

  let y = 670;
  const items = data.line_items ?? [];
  if (items.length > 0) {
    page.drawText("Line items", { x: 50, y, size: 12, font, color: ink });
    y -= 18;
    for (const item of items) {
      const desc = clip(asText(item.description) || "Item", 60);
      const amount = asMoney(item.amount).toFixed(2);
      page.drawText(`${desc}  ${amount}`, {
        x: 50,
        y,
        size: 10,
        font,
        color: muted,
      });
      y -= 14;
    }
    y -= 10;
  }

  page.drawText("Client Name:", { x: 50, y, size: 12, font, color: ink });
  const clientNameField = form.createTextField("client.name");
  clientNameField.setText(data.client_name);
  clientNameField.addToPage(page, {
    x: 150,
    y: y - 10,
    width: 350,
    height: 25,
  });
  y -= 60;

  page.drawText(`Total (${data.currency}):`, {
    x: 50,
    y,
    size: 12,
    font,
    color: ink,
  });
  const amountField = form.createTextField("invoice.total");
  amountField.setText(data.total.toFixed(2));
  amountField.addToPage(page, {
    x: 150,
    y: y - 10,
    width: 150,
    height: 25,
  });
  y -= 60;

  const notesDefault =
    asText(data.notes) ||
    asText(data.payment_terms) ||
    "Payment due within 30 days of receipt.";

  page.drawText("Notes / Terms:", { x: 50, y, size: 12, font, color: ink });
  const notesField = form.createTextField("invoice.notes");
  notesField.enableMultiline();
  notesField.setText(clip(notesDefault, 2000));
  notesField.addToPage(page, {
    x: 150,
    y: Math.max(80, y - 90),
    width: 350,
    height: 70,
  });

  try {
    form.updateFieldAppearances(font);
  } catch {
    /* Helvetica cannot encode some Unicode; viewers still show field values. */
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
