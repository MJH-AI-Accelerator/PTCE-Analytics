import * as XLSX from "xlsx";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  sheetNames: string[];
  selectedSheet: string;
}

export function parseFile(buffer: ArrayBuffer, sheetName?: string): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetNames = workbook.SheetNames;
  const selected = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const sheet = workbook.Sheets[selected];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

  return {
    headers,
    rows: jsonData,
    sheetNames,
    selectedSheet: selected,
  };
}
