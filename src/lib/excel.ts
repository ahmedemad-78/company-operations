import "server-only";

import ExcelJS from "exceljs";

/**
 * تصدير Excel عربي RTL. كل التقارير تستخدم نفس الشكل:
 * عنوان + سطر تاريخ + رأس جدول ملوّن + بيانات + صف إجماليات اختياري.
 */

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
  /** مبالغ وأرقام تُعرض بتنسيق أرقام */
  numeric?: boolean;
};

export async function buildWorkbook({
  title,
  subtitle,
  columns,
  rows,
  totals,
  sheetName = "تقرير",
}: {
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  totals?: Record<string, string | number | null | undefined>;
  sheetName?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "نظام إدارة وتشغيل الشركة";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 30), {
    views: [{ rightToLeft: true, state: "frozen", ySplit: subtitle ? 4 : 3 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  sheet.columns = columns.map((column) => ({
    key: column.key,
    width: column.width ?? 18,
  }));

  const titleRow = sheet.addRow([title]);
  titleRow.font = { size: 14, bold: true };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, columns.length);
  titleRow.alignment = { horizontal: "center", vertical: "middle" };

  if (subtitle) {
    const subtitleRow = sheet.addRow([subtitle]);
    subtitleRow.font = { size: 11, color: { argb: "FF64748B" } };
    sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, columns.length);
    subtitleRow.alignment = { horizontal: "center" };
  }

  sheet.addRow([]);

  const headerRow = sheet.addRow(columns.map((column) => column.header));
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  for (const row of rows) {
    const added = sheet.addRow(columns.map((column) => row[column.key] ?? ""));
    added.alignment = { horizontal: "right", vertical: "middle" };
    added.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      if (columns[colNumber - 1]?.numeric) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "center" };
      }
    });
  }

  if (totals) {
    const totalsRow = sheet.addRow(
      columns.map((column) => totals[column.key] ?? ""),
    );
    totalsRow.font = { bold: true };
    totalsRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      if (columns[colNumber - 1]?.numeric) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "center" };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** اسم ملف آمن للتنزيل مع دعم الاسم العربي */
export function downloadHeaders(fileName: string): Record<string, string> {
  const encoded = encodeURIComponent(`${fileName}.xlsx`);
  return {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="report.xlsx"; filename*=UTF-8''${encoded}`,
    "Cache-Control": "no-store",
  };
}
