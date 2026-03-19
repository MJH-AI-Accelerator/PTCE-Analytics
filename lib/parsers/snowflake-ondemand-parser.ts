import * as XLSX from "xlsx";
import type {
  ParsedActivityData,
  ParsedLearner,
  ParsedQuestion,
  ParsedLearnerResponse,
  ParsedEvaluationResponse,
  ParseWarning,
} from "./types";
import {
  likertToNumeric,
  confidenceBinary,
  confidenceAverage,
  computeAssessmentScore,
  confidenceChange,
} from "./confidence-scorer";

/**
 * Parse a Snowflake on-demand export (Type 3).
 * Same base format as Type 2 (rows 1-2 metadata, row 3 headers, row 4+ data).
 * Columns classified by prefix: (Pre Test : -), (Post Test : -), (Confidence Question : -),
 * (Evaluation : -), (ARSQuestion : -), (EnduringSurveyQuestions : -), (Surveyquestions : -).
 * Appends "(On-Demand)" to suggested activity name.
 */
export function parseSnowflakeOnDemandFile(buffer: ArrayBuffer, fileName: string): ParsedActivityData {
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

  // Classify columns by prefix
  const classified = classifyOnDemandColumns(headers);

  // Build questions
  const questions: ParsedQuestion[] = [];
  let globalQNum = 1;

  for (const col of classified.preTestCols) {
    questions.push({
      questionNumber: globalQNum,
      questionText: col.cleanText,
      questionType: "assessment",
    });
    col.globalQNum = globalQNum++;
  }

  for (const col of classified.confidenceCols) {
    questions.push({
      questionNumber: globalQNum,
      questionText: col.cleanText,
      questionType: "confidence",
    });
    col.globalQNum = globalQNum++;
  }

  for (const col of classified.arsCols) {
    questions.push({
      questionNumber: globalQNum,
      questionText: col.cleanText,
      questionType: "ars",
    });
    col.globalQNum = globalQNum++;
  }

  for (const col of classified.pulseCols) {
    questions.push({
      questionNumber: globalQNum,
      questionText: col.cleanText,
      questionType: "pulse",
    });
    col.globalQNum = globalQNum++;
  }

  // Evaluation questions (numbered separately for eval responses)
  let evalQNum = 1;
  for (const col of classified.evaluationCols) {
    questions.push({
      questionNumber: globalQNum++,
      questionText: col.cleanText,
      questionType: "evaluation",
      evalCategory: col.evalCategory,
      facultyName: col.facultyName,
    });
    col.evalQNum = evalQNum++;
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

    // Demographics (from EnduringSurveyQuestions columns)
    const demographics: Record<string, string | null> = {};
    for (const demo of classified.demographicCols) {
      demographics[demo.name] = getCellValue(demo.col);
    }

    // Assessment responses
    const responses: ParsedLearnerResponse[] = [];

    // Pre-test
    for (const col of classified.preTestCols) {
      const answer = getCellValue(col.col);
      if (answer != null) {
        responses.push({
          questionNumber: col.globalQNum!,
          phase: "pre",
          learnerAnswer: answer,
          isCorrect: null, // Needs answer key
          numericValue: null,
        });
      }
    }

    // Post-test — match by position to pre-test questions
    for (let i = 0; i < classified.postTestCols.length; i++) {
      const col = classified.postTestCols[i];
      const answer = getCellValue(col.col);
      // Match to corresponding pre-test question
      const preQ = classified.preTestCols[i];
      const qNum = preQ?.globalQNum ?? (i + 1);

      if (answer != null) {
        responses.push({
          questionNumber: qNum,
          phase: "post",
          learnerAnswer: answer,
          isCorrect: null, // Needs answer key
          numericValue: null,
        });
      }
    }

    // Confidence responses
    for (const col of classified.confidenceCols) {
      const answer = getCellValue(col.col);
      if (answer != null) {
        const numeric = likertToNumeric(answer);
        // Determine phase: pre-confidence appears in (Pre Test) section, post in (Confidence Question)
        responses.push({
          questionNumber: col.globalQNum!,
          phase: col.isPreConfidence ? "pre" : "post",
          learnerAnswer: answer,
          isCorrect: confidenceBinary(numeric),
          numericValue: numeric,
        });
      }
    }

    // ARS responses (no scoring)
    for (const col of classified.arsCols) {
      const answer = getCellValue(col.col);
      if (answer != null) {
        responses.push({
          questionNumber: col.globalQNum!,
          phase: "post",
          learnerAnswer: answer,
          isCorrect: null,
          numericValue: null,
        });
      }
    }

    // Pulse responses
    for (const col of classified.pulseCols) {
      const answer = getCellValue(col.col);
      if (answer != null) {
        responses.push({
          questionNumber: col.globalQNum!,
          phase: "post",
          learnerAnswer: answer,
          isCorrect: null,
          numericValue: null,
        });
      }
    }

    // Evaluation responses
    const evaluationResponses: ParsedEvaluationResponse[] = [];
    for (const col of classified.evaluationCols) {
      const rawValue = getCellValue(col.col);
      if (rawValue == null) continue;

      // Multi-select fields: split on semicolons
      if (col.isMultiSelect && rawValue.includes(";")) {
        const parts = rawValue.split(";").map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          evaluationResponses.push({
            questionNumber: col.evalQNum!,
            questionText: col.cleanText,
            evalCategory: col.evalCategory ?? "custom",
            responseText: part,
            responseNumeric: null,
            facultyName: col.facultyName,
          });
        }
      } else {
        evaluationResponses.push({
          questionNumber: col.evalQNum!,
          questionText: col.cleanText,
          evalCategory: col.evalCategory ?? "custom",
          responseText: rawValue,
          responseNumeric: null,
          facultyName: col.facultyName,
        });
      }
    }

    // Compute aggregates
    const preAssessment = responses.filter((r) => r.phase === "pre" && classified.preTestCols.some((c) => c.globalQNum === r.questionNumber));
    const postAssessment = responses.filter((r) => r.phase === "post" && classified.preTestCols.some((c) => c.globalQNum === r.questionNumber));
    const preConfidence = responses.filter((r) => r.phase === "pre" && r.numericValue != null);
    const postConfidence = responses.filter((r) => r.phase === "post" && r.numericValue != null && classified.confidenceCols.some((c) => c.globalQNum === r.questionNumber));

    const preScore = computeAssessmentScore(preAssessment);
    const postScore = computeAssessmentScore(postAssessment);
    const preConfAvg = confidenceAverage(preConfidence.map((r) => r.numericValue));
    const postConfAvg = confidenceAverage(postConfidence.map((r) => r.numericValue));

    learners.push({
      email,
      firstName,
      lastName,
      employer,
      practiceSetting: demographics["practice_setting"] ?? demographics["Practice Focus"] ?? null,
      role: demographics["role"] ?? demographics["Position"] ?? null,
      demographics,
      responses,
      evaluationResponses,
      presenterResponses: [],
      preScore,
      postScore,
      scoreChange: preScore != null && postScore != null ? postScore - preScore : null,
      preConfidenceAvg: preConfAvg,
      postConfidenceAvg: postConfAvg,
      confidenceChange: confidenceChange(preConfAvg, postConfAvg),
      comments: null,
    });
  }

  // Extract suggested activity name + append "(On-Demand)"
  const titleCell = sheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  let suggestedName = titleCell?.v ? String(titleCell.v).trim() : null;
  if (suggestedName && !suggestedName.includes("(On-Demand)")) {
    suggestedName = `${suggestedName} (On-Demand)`;
  }

  return {
    source: "snowflake_ondemand",
    sourceFileName: fileName,
    suggestedActivityName: suggestedName,
    questions,
    learners,
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}

interface OnDemandColumn {
  col: number;
  text: string;
  cleanText: string;
  globalQNum?: number;
  evalQNum?: number;
  isPreConfidence?: boolean;
  isMultiSelect?: boolean;
  evalCategory?: "practice_profile" | "intended_change" | "barrier" | "demographic" | "custom" | "faculty_rating" | "overall_rating" | "learning_objective_rating";
  facultyName?: string;
}

interface ClassifiedOnDemandColumns {
  emailCol: number;
  firstNameCol: number;
  lastNameCol: number;
  employerCol: number;
  demographicCols: { col: number; name: string }[];
  preTestCols: OnDemandColumn[];
  postTestCols: OnDemandColumn[];
  confidenceCols: OnDemandColumn[];
  evaluationCols: OnDemandColumn[];
  arsCols: OnDemandColumn[];
  pulseCols: OnDemandColumn[];
}

function classifyOnDemandColumns(headers: { col: number; text: string }[]): ClassifiedOnDemandColumns {
  const result: ClassifiedOnDemandColumns = {
    emailCol: -1,
    firstNameCol: -1,
    lastNameCol: -1,
    employerCol: -1,
    demographicCols: [],
    preTestCols: [],
    postTestCols: [],
    confidenceCols: [],
    evaluationCols: [],
    arsCols: [],
    pulseCols: [],
  };

  for (const h of headers) {
    const text = h.text;
    const lower = text.toLowerCase();

    // Identity columns (not prefixed)
    if (lower === "email" || lower === "email address" || lower === "e-mail") {
      result.emailCol = h.col;
      continue;
    }
    if (/first\s*name/i.test(text)) {
      result.firstNameCol = h.col;
      continue;
    }
    if (/last\s*name/i.test(text)) {
      result.lastNameCol = h.col;
      continue;
    }
    if (/^(id|user\s*id|submission|date|time|status|state|zip|city|phone)/i.test(text)) {
      continue;
    }

    // Detect prefix
    const preTestMatch = text.match(/^\(Pre Test\s*:\s*-\)\s*(.+)/i);
    if (preTestMatch) {
      const cleanText = preTestMatch[1].trim();
      // Check if this is a confidence question within pre-test section
      if (/confidence/i.test(cleanText)) {
        result.confidenceCols.push({ col: h.col, text, cleanText, isPreConfidence: true });
      } else {
        result.preTestCols.push({ col: h.col, text, cleanText });
      }
      continue;
    }

    const postTestMatch = text.match(/^\(Post Test\s*:\s*-\)\s*(.+)/i);
    if (postTestMatch) {
      result.postTestCols.push({ col: h.col, text, cleanText: postTestMatch[1].trim() });
      continue;
    }

    const confidenceMatch = text.match(/^\(Confidence Question\s*:\s*-\)\s*(.+)/i);
    if (confidenceMatch) {
      result.confidenceCols.push({ col: h.col, text, cleanText: confidenceMatch[1].trim(), isPreConfidence: false });
      continue;
    }

    const evalMatch = text.match(/^\(Evaluation\s*:\s*-\)\s*(.+)/i);
    if (evalMatch) {
      const cleanText = evalMatch[1].trim();
      const evalCol = classifyEvalColumn(h.col, cleanText);
      result.evaluationCols.push(evalCol);
      continue;
    }

    const arsMatch = text.match(/^\(ARSQuestion\s*:\s*-\)\s*(.+)/i);
    if (arsMatch) {
      result.arsCols.push({ col: h.col, text, cleanText: arsMatch[1].trim() });
      continue;
    }

    const enduringSurveyMatch = text.match(/^\(EnduringSurveyQuestions\s*:\s*-\)\s*(.+)/i);
    if (enduringSurveyMatch) {
      const cleanText = enduringSurveyMatch[1].trim();
      // EnduringSurveyQuestions are demographics
      if (/employer/i.test(cleanText)) {
        result.employerCol = h.col;
      } else {
        result.demographicCols.push({ col: h.col, name: cleanText });
      }
      continue;
    }

    const surveyMatch = text.match(/^\(Surveyquestions\s*:\s*-\)\s*(.+)/i);
    if (surveyMatch) {
      result.pulseCols.push({ col: h.col, text, cleanText: surveyMatch[1].trim() });
      continue;
    }
  }

  return result;
}

function classifyEvalColumn(col: number, cleanText: string): OnDemandColumn {
  const lower = cleanText.toLowerCase();

  if (/overall\s*(quality|rating)/i.test(lower)) {
    return { col, text: cleanText, cleanText, evalCategory: "overall_rating", isMultiSelect: false };
  }
  if (/learning\s*objective/i.test(lower) || /^lo\s*\d/i.test(lower)) {
    return { col, text: cleanText, cleanText, evalCategory: "learning_objective_rating", isMultiSelect: false };
  }
  if (/faculty|speaker|presenter/i.test(lower) || /,\s*(pharm\.?d|md|pharmd|bcop|bcps)/i.test(cleanText)) {
    const facultyName = cleanText.replace(/^(rate|rating|faculty\s*rating)\s*[-:]\s*/i, "").trim();
    return { col, text: cleanText, cleanText, evalCategory: "faculty_rating", isMultiSelect: false, facultyName };
  }
  if (/practice|percentage|%.*role|patient\s*interaction/i.test(lower)) {
    return { col, text: cleanText, cleanText, evalCategory: "practice_profile", isMultiSelect: false };
  }
  if (/change|implement|intend/i.test(lower)) {
    return { col, text: cleanText, cleanText, evalCategory: "intended_change", isMultiSelect: true };
  }
  if (/barrier|obstacle|challenge/i.test(lower)) {
    return { col, text: cleanText, cleanText, evalCategory: "barrier", isMultiSelect: true };
  }

  return { col, text: cleanText, cleanText, evalCategory: "custom", isMultiSelect: false };
}

function emptyResult(fileName: string, warnings: ParseWarning[]): ParsedActivityData {
  return {
    source: "snowflake_ondemand",
    sourceFileName: fileName,
    suggestedActivityName: null,
    questions: [],
    learners: [],
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}
