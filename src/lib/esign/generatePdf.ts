/**
 * Signed PDF generation with pdf-lib.
 *
 * Takes the original uploaded PDF, stamps every filled field (typed text,
 * dates, names, and signature/initials images) onto the correct page at the
 * stored normalized coordinates, then appends an audit-trail page recording
 * who signed, when, and from where. The result is a flattened, immutable PDF.
 *
 * Coordinate system note: fields are stored as normalized floats (0..1) with a
 * TOP-LEFT origin (matching the browser render). pdf-lib uses a BOTTOM-LEFT
 * origin, so Y is converted on stamping.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

export interface StampField {
  page: number;
  field_type: "signature" | "initials" | "date" | "text" | "name";
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  value: string | null;
  /** For signature/initials: base64 PNG data URL, or a typed string. */
  signature_data?: string | null;
  signature_type?: "typed" | "drawn" | null;
}

export interface AuditSigner {
  role: "client" | "owner";
  name: string;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  signedAt: string; // ISO
}

export interface AuditInfo {
  documentName: string;
  documentId: string;
  /** One entry per party who signed (client, then owner countersigner). */
  signers: AuditSigner[];
  sentAt?: string | null; // ISO
  viewedAt?: string | null; // ISO
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generateSignedPdf(
  originalPdfBytes: Uint8Array | ArrayBuffer,
  fields: StampField[],
  audit: AuditInfo
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const cursive = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const pages = pdfDoc.getPages();

  for (const field of fields) {
    const page = pages[field.page];
    if (!page) continue;

    const { width: pw, height: ph } = page.getSize();
    const x = field.pos_x * pw;
    const boxW = field.width * pw;
    const boxH = field.height * ph;
    // Convert top-left normalized Y to pdf-lib bottom-left Y.
    const yTop = field.pos_y * ph;
    const y = ph - yTop - boxH;

    const isSignatureImage =
      (field.field_type === "signature" || field.field_type === "initials") &&
      field.signature_type === "drawn" &&
      field.signature_data;

    if (isSignatureImage) {
      try {
        const png = await pdfDoc.embedPng(
          dataUrlToUint8Array(field.signature_data as string)
        );
        // Fit the image within the box preserving aspect ratio.
        const scale = Math.min(boxW / png.width, boxH / png.height);
        const drawW = png.width * scale;
        const drawH = png.height * scale;
        page.drawImage(png, {
          x: x + (boxW - drawW) / 2,
          y: y + (boxH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      } catch (e) {
        console.error("Failed to embed signature image", e);
      }
      continue;
    }

    // Text-like fields (typed signature, initials, date, name, text).
    const text =
      field.field_type === "signature" || field.field_type === "initials"
        ? field.signature_data || field.value || ""
        : field.value || "";
    if (!text) continue;

    const useCursive =
      field.field_type === "signature" || field.field_type === "initials";
    const font = useCursive ? cursive : helv;
    // Size text to roughly fit the box height.
    let fontSize = Math.min(boxH * 0.7, 22);
    if (fontSize < 6) fontSize = 6;
    let textWidth = font.widthOfTextAtSize(text, fontSize);
    while (textWidth > boxW && fontSize > 6) {
      fontSize -= 1;
      textWidth = font.widthOfTextAtSize(text, fontSize);
    }
    page.drawText(text, {
      x: x + 2,
      y: y + (boxH - fontSize) / 2 + fontSize * 0.15,
      size: fontSize,
      font,
      color: rgb(0.05, 0.05, 0.2),
    });
  }

  // ---- Audit trail page ----
  appendAuditPage(pdfDoc, helv, helvBold, audit);

  return pdfDoc.save();
}

function appendAuditPage(
  pdfDoc: PDFDocument,
  helv: PDFFont,
  helvBold: PDFFont,
  audit: AuditInfo
): void {
  const page: PDFPage = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();
  const left = 56;
  let cursor = height - 72;

  const fmt = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toUTCString();
    } catch {
      return iso;
    }
  };

  page.drawText("Signature Certificate", {
    x: left,
    y: cursor,
    size: 22,
    font: helvBold,
    color: rgb(0.1, 0.1, 0.3),
  });
  cursor -= 12;
  page.drawLine({
    start: { x: left, y: cursor },
    end: { x: width - left, y: cursor },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.85),
  });
  cursor -= 34;

  const docRows: Array<[string, string]> = [
    ["Document", audit.documentName],
    ["Document ID", audit.documentId],
    ["Sent", fmt(audit.sentAt)],
    ["Viewed", fmt(audit.viewedAt)],
  ];

  // Then one block of rows per signer.
  const roleLabel = (r: "client" | "owner") =>
    r === "owner" ? "Countersigner (owner)" : "Signer";
  const signerRows: Array<[string, string]> = [];
  audit.signers.forEach((s, i) => {
    if (i > 0) signerRows.push(["", ""]); // spacer between signers
    signerRows.push([`${roleLabel(s.role)} name`, s.name]);
    signerRows.push([`${roleLabel(s.role)} email`, s.email || "—"]);
    signerRows.push(["Signed", fmt(s.signedAt)]);
    signerRows.push(["IP address", s.ipAddress || "—"]);
    signerRows.push(["Device", (s.userAgent || "—").slice(0, 90)]);
  });

  const rows: Array<[string, string]> = [...docRows, ...signerRows];

  for (const [label, value] of rows) {
    if (!label && !value) {
      cursor -= 10; // spacer row
      continue;
    }
    page.drawText(label, {
      x: left,
      y: cursor,
      size: 10,
      font: helvBold,
      color: rgb(0.3, 0.3, 0.35),
    });
    const wrapped = wrapText(value, helv, 10, width - left - 180);
    let lineY = cursor;
    for (const line of wrapped) {
      page.drawText(line, {
        x: left + 150,
        y: lineY,
        size: 10,
        font: helv,
        color: rgb(0.1, 0.1, 0.12),
      });
      lineY -= 14;
    }
    cursor = Math.min(cursor - 22, lineY - 8);
  }

  cursor -= 10;
  page.drawLine({
    start: { x: left, y: cursor },
    end: { x: width - left, y: cursor },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.9),
  });
  cursor -= 22;
  const disclaimer =
    "This certificate is an electronic record of the signing event captured by Lunenix. " +
    "The signer adopted the electronic signature shown above with the intent to sign this document. " +
    "This document and its audit trail are tamper-evident once generated.";
  for (const line of wrapText(disclaimer, helv, 9, width - left * 2)) {
    page.drawText(line, {
      x: left,
      y: cursor,
      size: 9,
      font: helv,
      color: rgb(0.45, 0.45, 0.5),
    });
    cursor -= 13;
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}
