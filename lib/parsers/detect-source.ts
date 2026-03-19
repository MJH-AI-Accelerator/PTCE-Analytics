import * as XLSX from "xlsx";
import type { DataSource, DetectionResult } from "./types";

/**
 * Auto-detect the data source from an Excel/CSV file buffer.
 * Examines sheet names, header patterns, and cell content.
 */
export function detectSource(buffer: ArrayBuffer): DetectionResult | null {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetNames = workbook.SheetNames;

  // Check for Pigeonhole: "Poll By Users" sheet
  if (sheetNames.some((s) => s.toLowerCase().includes("poll by users"))) {
    return {
      source: "pigeonhole",
      confidence: "high",
      signals: ["Sheet 'Poll By Users' found"],
    };
  }

  // Check for Array: "Survey" + "Survey Summary" + "Reportable Participants" sheets
  const hasArray =
    sheetNames.some((s) => s === "Survey") &&
    sheetNames.some((s) => s === "Survey Summary") &&
    sheetNames.some((s) => s === "Reportable Participants");
  if (hasArray) {
    return {
      source: "array",
      confidence: "high",
      signals: ["Sheets: Survey, Survey Summary, Reportable Participants"],
    };
  }

  // Read the first sheet for header inspection
  const sheet = workbook.Sheets[sheetNames[0]];
  if (!sheet) return null;

  // Get headers — check different rows depending on format
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  // Check for GlobalMeet: Row 4 (0-indexed row 3) headers containing "Survey: Pretest" pattern
  const row4Headers = getRowValues(sheet, 3, range);
  if (row4Headers.some((h) => /survey:\s*pretest/i.test(h))) {
    return {
      source: "globalmeet",
      confidence: "high",
      signals: ["Row 4 headers contain 'Survey: Pretest' pattern"],
    };
  }

  // Check for Snowflake files: Row 3 (0-indexed row 2) headers
  const row3Headers = getRowValues(sheet, 2, range);

  // Snowflake On-Demand: headers with "(Pre Test : -)" or "(Post Test : -)" prefixes
  const hasPreTestPrefix = row3Headers.some((h) => /\(Pre Test\s*:\s*-\)/i.test(h));
  const hasPostTestPrefix = row3Headers.some((h) => /\(Post Test\s*:\s*-\)/i.test(h));
  if (hasPreTestPrefix || hasPostTestPrefix) {
    return {
      source: "snowflake_ondemand",
      confidence: "high",
      signals: ["Headers contain '(Pre Test : -)' or '(Post Test : -)' prefixes"],
    };
  }

  // Snowflake Eval: headers with "(Evaluation : -)" prefix but no assessment prefixes
  const hasEvalPrefix = row3Headers.some((h) => /\(Evaluation\s*:\s*-\)/i.test(h));
  if (hasEvalPrefix && !hasPreTestPrefix && !hasPostTestPrefix) {
    return {
      source: "snowflake_eval",
      confidence: "high",
      signals: ["Headers contain '(Evaluation : -)' prefix with no assessment prefixes"],
    };
  }

  // Fallback: check row 1 headers for standard flat files
  const row1Headers = getRowValues(sheet, 0, range);

  // GlobalMeet fallback: check for "Event Id", "Total Duration" in row 4
  if (row4Headers.some((h) => /event\s*id/i.test(h)) && row4Headers.some((h) => /total\s*duration/i.test(h))) {
    return {
      source: "globalmeet",
      confidence: "medium",
      signals: ["Row 4 headers contain 'Event Id' and 'Total Duration'"],
    };
  }

  // Snowflake eval fallback: check row 3 for common eval columns without prefixes
  if (
    row3Headers.some((h) => /overall\s*(quality|rating)/i.test(h)) &&
    row3Headers.some((h) => /intended\s*change/i.test(h) || /barrier/i.test(h))
  ) {
    return {
      source: "snowflake_eval",
      confidence: "medium",
      signals: ["Row 3 headers suggest evaluation format"],
    };
  }

  return null;
}

/** Get all cell string values from a specific row (0-indexed). */
function getRowValues(sheet: XLSX.WorkSheet, rowIndex: number, range: XLSX.Range): string[] {
  const values: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c });
    const cell = sheet[addr];
    if (cell && cell.v != null) {
      values.push(String(cell.v));
    }
  }
  return values;
}
