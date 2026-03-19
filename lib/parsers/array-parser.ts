import * as XLSX from "xlsx";
import type {
  ParsedActivityData,
  ParsedLearner,
  ParsedQuestion,
  ParsedLearnerResponse,
  ParsedPresenterResponse,
  ParseWarning,
  QuestionType,
} from "./types";
import { extractAnswerKeyFromHighlighting } from "./answer-key";
import {
  likertToNumeric,
  confidenceBinary,
  confidenceAverage,
  computeAssessmentScore,
  confidenceChange,
} from "./confidence-scorer";

/**
 * Parse an Array report Excel file.
 * Expected sheets: Survey, Survey Summary, Reportable Participants, optionally Presenter Questions.
 * Multi-row header (rows 1-8), data from row 9.
 * Correct answers detected via #B5E09B cell background highlighting.
 */
export function parseArrayFile(buffer: ArrayBuffer, fileName: string): ParsedActivityData {
  const workbook = XLSX.read(buffer, { type: "array", cellStyles: true });
  const warnings: ParseWarning[] = [];

  // Extract answer key from highlighting before full parse
  const answerKey = extractAnswerKeyFromHighlighting(buffer, "Survey");

  // Parse the Survey sheet
  const surveySheet = workbook.Sheets["Survey"];
  if (!surveySheet) {
    return emptyResult("array", fileName, [{ type: "format", message: "'Survey' sheet not found" }]);
  }

  const range = XLSX.utils.decode_range(surveySheet["!ref"] || "A1");

  // Row 8 (0-indexed 7) contains column headers
  const headerRow = 7;
  const headers: { col: number; text: string }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = surveySheet[addr];
    if (cell && cell.v != null) {
      headers.push({ col: c, text: String(cell.v).trim() });
    }
  }

  // Classify columns
  const classified = classifyArrayColumns(headers);

  // Extract questions from classification
  const questions: ParsedQuestion[] = [];
  const answerKeyMap = new Map(answerKey.map((a) => [a.questionNumber, a.correctAnswer]));

  for (const q of classified.assessmentQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.headerText,
      questionType: "assessment",
      correctAnswer: answerKeyMap.get(q.questionNumber),
    });
  }

  for (const q of classified.confidenceQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.headerText,
      questionType: "confidence",
    });
  }

  for (const q of classified.arsQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.headerText,
      questionType: "ars",
    });
  }

  for (const q of classified.pulseQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.headerText,
      questionType: "pulse",
    });
  }

  // Parse learner data from row 9 onward (0-indexed row 8)
  const learners: ParsedLearner[] = [];
  const dataStartRow = 8;

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const getCellValue = (col: number): string | null => {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = surveySheet[addr];
      if (!cell || cell.v == null || cell.v === "") return null;
      return String(cell.v).trim();
    };

    // Extract identity fields
    const email = getCellValue(classified.emailCol);
    if (!email) {
      warnings.push({ type: "missing_data", message: `Row ${r + 1}: Missing email, skipped`, context: `row_${r + 1}` });
      continue;
    }

    const firstName = getCellValue(classified.firstNameCol);
    const lastName = getCellValue(classified.lastNameCol);
    const employer = getCellValue(classified.employerCol);

    // Demographics
    const demographics: Record<string, string | null> = {};
    for (const demo of classified.demographicCols) {
      let value = getCellValue(demo.col);
      // Merge "Other" + clarification
      if (value?.toLowerCase() === "other" && demo.clarificationCol != null) {
        const clarification = getCellValue(demo.clarificationCol);
        if (clarification) {
          value = `Other (${clarification})`;
        }
      }
      demographics[demo.name] = value;
    }

    // Assessment responses
    const responses: ParsedLearnerResponse[] = [];

    for (const q of classified.assessmentQuestions) {
      const preAnswer = getCellValue(q.preCol);
      const postAnswer = getCellValue(q.postCol);
      const correctAnswer = answerKeyMap.get(q.questionNumber);

      if (preAnswer != null) {
        responses.push({
          questionNumber: q.questionNumber,
          phase: "pre",
          learnerAnswer: preAnswer,
          isCorrect: correctAnswer ? preAnswer === correctAnswer : null,
          numericValue: null,
        });
      }
      if (postAnswer != null) {
        responses.push({
          questionNumber: q.questionNumber,
          phase: "post",
          learnerAnswer: postAnswer,
          isCorrect: correctAnswer ? postAnswer === correctAnswer : null,
          numericValue: null,
        });
      }
    }

    // Confidence responses
    for (const q of classified.confidenceQuestions) {
      const preAnswer = getCellValue(q.preCol);
      const postAnswer = getCellValue(q.postCol);

      if (preAnswer != null) {
        const numeric = likertToNumeric(preAnswer);
        responses.push({
          questionNumber: q.questionNumber,
          phase: "pre",
          learnerAnswer: preAnswer,
          isCorrect: confidenceBinary(numeric),
          numericValue: numeric,
        });
      }
      if (postAnswer != null) {
        const numeric = likertToNumeric(postAnswer);
        responses.push({
          questionNumber: q.questionNumber,
          phase: "post",
          learnerAnswer: postAnswer,
          isCorrect: confidenceBinary(numeric),
          numericValue: numeric,
        });
      }
    }

    // ARS responses (no scoring)
    for (const q of classified.arsQuestions) {
      const answer = getCellValue(q.col);
      if (answer != null) {
        responses.push({
          questionNumber: q.questionNumber,
          phase: "post",
          learnerAnswer: answer,
          isCorrect: null,
          numericValue: null,
        });
      }
    }

    // Pulse responses
    for (const q of classified.pulseQuestions) {
      const answer = getCellValue(q.col);
      if (answer != null) {
        responses.push({
          questionNumber: q.questionNumber,
          phase: "post",
          learnerAnswer: answer,
          isCorrect: null,
          numericValue: null,
        });
      }
    }

    // Compute aggregates
    const preAssessment = responses.filter((r) => r.phase === "pre" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "assessment");
    const postAssessment = responses.filter((r) => r.phase === "post" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "assessment");
    const preConfidence = responses.filter((r) => r.phase === "pre" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "confidence");
    const postConfidence = responses.filter((r) => r.phase === "post" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "confidence");

    const preScore = computeAssessmentScore(preAssessment);
    const postScore = computeAssessmentScore(postAssessment);
    const preConfAvg = confidenceAverage(preConfidence.map((r) => r.numericValue));
    const postConfAvg = confidenceAverage(postConfidence.map((r) => r.numericValue));

    learners.push({
      email,
      firstName,
      lastName,
      employer,
      practiceSetting: demographics["practice_setting"] ?? demographics["Practice Setting"] ?? null,
      role: demographics["role"] ?? demographics["Role"] ?? null,
      demographics,
      responses,
      evaluationResponses: [],
      presenterResponses: [],
      preScore,
      postScore,
      scoreChange: preScore != null && postScore != null ? postScore - preScore : null,
      preConfidenceAvg: preConfAvg,
      postConfidenceAvg: postConfAvg,
      confidenceChange: confidenceChange(preConfAvg, postConfAvg),
      comments: getCellValue(classified.commentsCol),
    });
  }

  // Parse presenter questions from "Presenter Questions" tab if it exists
  const presenterSheet = workbook.Sheets["Presenter Questions"];
  if (presenterSheet) {
    parsePresenterQuestions(presenterSheet, learners);
  }

  // Try to extract activity name from file metadata
  let suggestedName: string | null = null;
  // Check row 1 of Survey sheet for activity title
  const titleCell = surveySheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  if (titleCell && titleCell.v) {
    suggestedName = String(titleCell.v).trim();
  }

  return {
    source: "array",
    sourceFileName: fileName,
    suggestedActivityName: suggestedName,
    questions,
    learners,
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}

interface ClassifiedColumns {
  emailCol: number;
  firstNameCol: number;
  lastNameCol: number;
  employerCol: number;
  commentsCol: number;
  demographicCols: { col: number; name: string; clarificationCol?: number }[];
  assessmentQuestions: { questionNumber: number; headerText: string; preCol: number; postCol: number }[];
  confidenceQuestions: { questionNumber: number; headerText: string; preCol: number; postCol: number }[];
  arsQuestions: { questionNumber: number; headerText: string; col: number }[];
  pulseQuestions: { questionNumber: number; headerText: string; col: number }[];
}

function classifyArrayColumns(headers: { col: number; text: string }[]): ClassifiedColumns {
  const result: ClassifiedColumns = {
    emailCol: -1,
    firstNameCol: -1,
    lastNameCol: -1,
    employerCol: -1,
    commentsCol: -1,
    demographicCols: [],
    assessmentQuestions: [],
    confidenceQuestions: [],
    arsQuestions: [],
    pulseQuestions: [],
  };

  const preAssessmentCols = new Map<number, { col: number; text: string }>();
  const postAssessmentCols = new Map<number, { col: number; text: string }>();
  const preConfCols = new Map<number, { col: number; text: string }>();
  const postConfCols = new Map<number, { col: number; text: string }>();

  for (const h of headers) {
    const lower = h.text.toLowerCase();

    // Identity columns
    if (/^e-?mail/i.test(h.text) || lower === "email" || lower === "email address") {
      result.emailCol = h.col;
    } else if (/first\s*name/i.test(h.text)) {
      result.firstNameCol = h.col;
    } else if (/last\s*name/i.test(h.text)) {
      result.lastNameCol = h.col;
    } else if (/employer|organization|company/i.test(h.text)) {
      result.employerCol = h.col;
    } else if (/comment/i.test(h.text)) {
      result.commentsCol = h.col;
    }

    // Pre/post assessment questions
    const preQMatch = h.text.match(/pre\s*(?:test\s*)?(?:question|q)\s*(\d+)/i);
    if (preQMatch) {
      preAssessmentCols.set(parseInt(preQMatch[1]), h);
      continue;
    }
    const postQMatch = h.text.match(/post\s*(?:test\s*)?(?:question|q)\s*(\d+)/i);
    if (postQMatch) {
      postAssessmentCols.set(parseInt(postQMatch[1]), h);
      continue;
    }

    // Pre/post confidence
    const preConfMatch = h.text.match(/pre\s*(?:test\s*)?confidence\s*(?:question\s*)?(\d+)/i);
    if (preConfMatch) {
      preConfCols.set(parseInt(preConfMatch[1]), h);
      continue;
    }
    const postConfMatch = h.text.match(/post\s*(?:test\s*)?confidence\s*(?:question\s*)?(\d+)/i);
    if (postConfMatch) {
      postConfCols.set(parseInt(postConfMatch[1]), h);
      continue;
    }

    // ARS questions
    const arsMatch = h.text.match(/ars\s*(?:question\s*)?(\d+)/i);
    if (arsMatch) {
      result.arsQuestions.push({
        questionNumber: parseInt(arsMatch[1]),
        headerText: h.text,
        col: h.col,
      });
      continue;
    }

    // Pulse questions
    const pulseMatch = h.text.match(/pulse\s*(?:question\s*)?(\d+)/i);
    if (pulseMatch) {
      result.pulseQuestions.push({
        questionNumber: parseInt(pulseMatch[1]),
        headerText: h.text,
        col: h.col,
      });
      continue;
    }
  }

  // Pair pre/post assessment columns
  const allAssessmentNums = new Set([...preAssessmentCols.keys(), ...postAssessmentCols.keys()]);
  for (const qNum of [...allAssessmentNums].sort((a, b) => a - b)) {
    const pre = preAssessmentCols.get(qNum);
    const post = postAssessmentCols.get(qNum);
    if (pre || post) {
      result.assessmentQuestions.push({
        questionNumber: qNum,
        headerText: (pre || post)!.text,
        preCol: pre?.col ?? -1,
        postCol: post?.col ?? -1,
      });
    }
  }

  // Pair pre/post confidence columns
  const allConfNums = new Set([...preConfCols.keys(), ...postConfCols.keys()]);
  for (const qNum of [...allConfNums].sort((a, b) => a - b)) {
    const pre = preConfCols.get(qNum);
    const post = postConfCols.get(qNum);
    if (pre || post) {
      result.confidenceQuestions.push({
        questionNumber: qNum + 1000, // Offset to avoid conflict with assessment numbers
        headerText: (pre || post)!.text,
        preCol: pre?.col ?? -1,
        postCol: post?.col ?? -1,
      });
    }
  }

  // Identify demographic columns (columns that aren't identity, assessment, confidence, ars, pulse)
  const usedCols = new Set<number>([
    result.emailCol, result.firstNameCol, result.lastNameCol,
    result.employerCol, result.commentsCol,
    ...result.assessmentQuestions.flatMap((q) => [q.preCol, q.postCol]),
    ...result.confidenceQuestions.flatMap((q) => [q.preCol, q.postCol]),
    ...result.arsQuestions.map((q) => q.col),
    ...result.pulseQuestions.map((q) => q.col),
  ]);

  for (const h of headers) {
    if (!usedCols.has(h.col) && h.col >= 0) {
      // Check if this is an "Other" clarification column
      const isOtherClarification = /other.*specify|please\s*specify|if\s*other/i.test(h.text);
      if (!isOtherClarification) {
        // Check if next column is a clarification
        const nextHeader = headers.find((hh) => hh.col === h.col + 1);
        const clarCol = nextHeader && /other.*specify|please\s*specify|if\s*other/i.test(nextHeader.text)
          ? nextHeader.col
          : undefined;

        result.demographicCols.push({
          col: h.col,
          name: h.text,
          clarificationCol: clarCol,
        });
      }
    }
  }

  return result;
}

function parsePresenterQuestions(sheet: XLSX.WorkSheet, learners: ParsedLearner[]): void {
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (jsonData.length === 0) return;

  const headers = Object.keys(jsonData[0]);
  const emailCol = headers.find((h) => /email/i.test(h));
  if (!emailCol) return;

  // Find question/answer column pairs
  const qaCols: { questionCol: string; answerCol: string; num: number }[] = [];
  for (const h of headers) {
    const match = h.match(/question\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      const answerCol = headers.find((a) => new RegExp(`answer\\s*${num}`, "i").test(a));
      if (answerCol) {
        qaCols.push({ questionCol: h, answerCol, num });
      }
    }
  }

  for (const row of jsonData) {
    const email = String(row[emailCol] || "").trim().toLowerCase();
    if (!email) continue;

    const learner = learners.find((l) => l.email.toLowerCase() === email);
    if (!learner) continue;

    for (const qa of qaCols) {
      const question = String(row[qa.questionCol] || "").trim();
      const answer = String(row[qa.answerCol] || "").trim();
      if (question || answer) {
        learner.presenterResponses.push({
          questionNumber: qa.num,
          questionText: question,
          responseText: answer || null,
        });
      }
    }
  }
}

function emptyResult(source: "array", fileName: string, warnings: ParseWarning[]): ParsedActivityData {
  return {
    source,
    sourceFileName: fileName,
    suggestedActivityName: null,
    questions: [],
    learners: [],
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}
