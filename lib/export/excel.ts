import * as XLSX from "xlsx";

export interface ExportSheet {
  name: string;
  data: Record<string, unknown>[];
}

export function exportToExcel(sheets: ExportSheet[], fileName = "ptce-export.xlsx"): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (sheet.data.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
      XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
    } else {
      const ws = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
    }
  }

  XLSX.writeFile(workbook, fileName);
}
