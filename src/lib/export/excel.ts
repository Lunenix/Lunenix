import "server-only";

import ExcelJS from "exceljs";

export type ExcelColumn<T extends Record<string, unknown>> = {
  header: string;
  key: Extract<keyof T, string>;
  width?: number;
};

export async function generateExcelBuffer<T extends Record<string, unknown>>(
  sheetName: string,
  columns: ExcelColumn<T>[],
  data: T[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Sheet1");

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 20,
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };

  for (const row of data) {
    worksheet.addRow(row);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
