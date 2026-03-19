import * as XLSX from "xlsx";
import type {
  ParsedActivityData,
  ParsedLearner,
  ParsedQuestion,
  ParsedEvaluationResponse,
  ParseWarning,
} from "./types";

/**
 * Parse a Snowflake evaluation export (Type 2).
 * Skip rows 1-2 (metadata), row 3 headers, row 4+ data.
 * Ratings kept as text. Faculty ratings stored per faculty.
 * Multi-select fields split on semicolons. "-" → null.
 */
export function parseSnowflakeEvalFile(buffer: ArrayBuffer, fileName: string): ParsedActivityData {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return emptyResult(fileName, [{ type: "format", message: "No sheet found" }]);
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const warnings: ParseWarning[] = [];

  // Row 3 (0-indexed 2) has headers
  const headerRow = 2;
  const headers: { col: number; text: string }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = sheet[addr];
    if (cell && cell.v != null) {
      headers.push({ col: c, text: String(cell.v).trim() });
    }
  }

  // Classify columns
  const classified = classifyEvalColumns(headers);
  const questions: ParsedQuestion[] = [];
  let qNum = 1;

  // Build evaluation questions
  for (const col of classified.evaluationCols) {
    questions.push({
      questionNumber: qNum++,
      questionText: col.text,
      questionType: "evaluation",
      evalCategory: col.evalCategory,
      facultyName: col.facultyName,
    });
  }

  // Parse learner data from row 4 onward (0-indexed row 3)
  const learners: ParsedLearner[] = [];
  const dataStartRow = 3;

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const getCellValue = (col: number): string | null => {
      if (col < 0) return null;
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = sheet[addr];
      if (!cell || cell.v == null || cell.v === "" || cell.v === "-") return null;
      return String(cell.v).trim();
    };

    const email = getCellValue(classified.emailCol);
    if (!email) continue;

    const firstName = getCellValue(classified.firstNameCol);
    const lastName = getCellValue(classified.lastNameCol);
    const employer = getCellValue(classified.employerCol);

    // Demographics
    const demographics: Record<string, string | null> = {};
    for (const demo of classified.demographicCols) {
      demographics[demo.name] = getCellValue(demo.col);
    }

    // Evaluation responses
    const evaluationResponses: ParsedEvaluationResponse[] = [];
    let evalQNum = 1;

    for (const col of classified.evaluationCols) {
      const rawValue = getCellValue(col.col);
      if (rawValue == null) {
        evalQNum++;
        continue;
      }

      // Multi-select fields: split on semicolons
      if (col.isMultiSelect && rawValue.includes(";")) {
        const parts = rawValue.split(";").map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          evaluationResponses.push({
            questionNumber: evalQNum,
            questionText: col.text,
            evalCategory: col.evalCategory,
            responseText: part,
            responseNumeric: null,
            facultyName: col.facultyName,
          });
        }
      } else {
        evaluationResponses.push({
          questionNumber: evalQNum,
          questionText: col.text,
          evalCategory: col.evalCategory,
          responseText: rawValue,
          responseNumeric: null,
          facultyName: col.facultyName,
        });
      }

      evalQNum++;
    }

    learners.push({
      email,
      firstName,
      lastName,
      employer,
      practiceSetting: demographics["practice_setting"] ?? demographics["Practice Setting"] ?? null,
      role: demographics["role"] ?? demographics["Role"] ?? null,
      demographics,
      responses: [],
      evaluationResponses,
      presenterResponses: [],
      preScore: null,
      postScore: null,
      scoreChange: null,
      preConfidenceAvg: null,
      postConfidenceAvg: null,
      confidenceChange: null,
      comments: getCellValue(classified.commentsCol),
    });
  }

  // Extract suggested activity name from row 1
  const titleCell = sheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  const suggestedName = titleCell?.v ? String(titleCell.v).trim() : null;

  return {
    source: "snowflake_eval",
    sourceFileName: fileName,
    suggestedActivityName: suggestedName,
    questions,
    learners,
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}

interface EvalColumn {
  col: number;
  text: string;
  evalCategory: "practice_profile" | "intended_change" | "barrier" | "demographic" | "custom" | "faculty_rating" | "overall_rating" | "learning_objective_rating";
  isMultiSelect: boolean;
  facultyName?: string;
}

interface ClassifiedEvalColumns {
  emailCol: number;
  firstNameCol: number;
  lastNameCol: number;
  employerCol: number;
  commentsCol: number;
  demographicCols: { col: number; name: string }[];
  evaluationCols: EvalColumn[];
}

function classifyEvalColumns(headers: { col: number; text: string }[]): ClassifiedEvalColumns {
  const result: ClassifiedEvalColumns = {
    emailCol: -1,
    firstNameCol: -1,
    lastNameCol: -1,
    employerCol: -1,
    commentsCol: -1,
    demographicCols: [],
    evaluationCols: [],
  };

  for (const h of headers) {
    const lower = h.text.toLowerCase();

    // Identity columns
    if (lower === "email" || lower === "email address" || lower === "e-mail") {
      result.emailCol = h.col;
      continue;
    }
    if (/first\s*name/i.test(h.text)) {
      result.firstNameCol = h.col;
      continue;
    }
    if (/last\s*name/i.test(h.text)) {
      result.lastNameCol = h.col;
      continue;
    }
    if (/^employer$/i.test(h.text) || /organization/i.test(h.text)) {
      result.employerCol = h.col;
      continue;
    }
    if (/comment/i.test(h.text)) {
      result.commentsCol = h.col;
      continue;
    }

    // Skip non-data columns
    if (/^(id|user\s*id|submission|date|time|status|state|zip|city|phone)/i.test(h.text)) {
      if (/state|zip/i.test(h.text)) {
        result.demographicCols.push({ col: h.col, name: h.text });
      }
      continue;
    }

    // Classify evaluation columns
    const evalCol = classifyEvalColumn(h);
    if (evalCol) {
      result.evaluationCols.push(evalCol);
    }
  }

  return result;
}

function classifyEvalColumn(h: { col: number; text: string }): EvalColumn | null {
  const lower = h.text.toLowerCase();

  // Strip "(Evaluation : -)" prefix if present
  const cleanText = h.text.replace(/^\(Evaluation\s*:\s*-\)\s*/i, "").trim();
  const cleanLower = cleanText.toLowerCase();

  // Overall quality/rating
  if (/overall\s*(quality|rating)/i.test(cleanLower)) {
    return { col: h.col, text: cleanText, evalCategory: "overall_rating", isMultiSelect: false };
  }

  // Learning objective ratings
  if (/learning\s*objective/i.test(cleanLower) || /^lo\s*\d/i.test(cleanLower) || /objective\s*\d/i.test(cleanLower)) {
    return { col: h.col, text: cleanText, evalCategory: "learning_objective_rating", isMultiSelect: false };
  }

  // Faculty ratings — often contain names with credentials (PharmD, MD, etc.)
  if (/faculty|speaker|presenter/i.test(cleanLower) || /,\s*(pharm\.?d|md|pharmd|bcop|bcps|do|rph)/i.test(cleanText)) {
    const facultyName = cleanText.replace(/^(rate|rating|faculty\s*rating)\s*[-:]\s*/i, "").trim();
    return { col: h.col, text: cleanText, evalCategory: "faculty_rating", isMultiSelect: false, facultyName };
  }

  // Practice profile
  if (/practice|percentage|%.*role|role.*%|primary\s*practice|patient\s*interaction/i.test(cleanLower)) {
    return { col: h.col, text: cleanText, evalCategory: "practice_profile", isMultiSelect: false };
  }

  // Barriers — check BEFORE intended changes (barrier text often contains "implement")
  if (/barrier|obstacle|challenge/i.test(cleanLower)) {
    return { col: h.col, text: cleanText, evalCategory: "barrier", isMultiSelect: true };
  }

  // Intended changes
  if (/change|implement|intend|will\s*you/i.test(cleanLower)) {
    return { col: h.col, text: cleanText, evalCategory: "intended_change", isMultiSelect: true };
  }

  // Bias / new content / other eval questions
  if (/bias|new\s*(?:content|information)|commercial/i.test(cleanLower)) {
    return { col: h.col, text: cleanText, evalCategory: "custom", isMultiSelect: false };
  }

  // Default: custom evaluation
  return { col: h.col, text: cleanText, evalCategory: "custom", isMultiSelect: false };
}

function emptyResult(fileName: string, warnings: ParseWarning[]): ParsedActivityData {
  return {
    source: "snowflake_eval",
    sourceFileName: fileName,
    suggestedActivityName: null,
    questions: [],
    learners: [],
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}
