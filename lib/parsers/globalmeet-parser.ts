import * as XLSX from "xlsx";
import type {
  ParsedActivityData,
  ParsedLearner,
  ParsedQuestion,
  ParsedLearnerResponse,
  ParsedPresenterResponse,
  ParseWarning,
} from "./types";
import {
  likertToNumeric,
  confidenceBinary,
  confidenceAverage,
  computeAssessmentScore,
  confidenceChange,
} from "./confidence-scorer";

const MIN_DURATION = 0.001389; // 2 minutes as fraction of a day

/**
 * Parse a GlobalMeet webinar report.
 * Rows 1-3 metadata, row 4 headers, row 5+ data.
 * Columns detected by header text pattern, NOT position.
 */
export function parseGlobalMeetFile(buffer: ArrayBuffer, fileName: string): ParsedActivityData {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return emptyResult(fileName, [{ type: "format", message: "No sheet found" }]);
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const warnings: ParseWarning[] = [];

  // Extract metadata from rows 1-3
  const metadata: Record<string, string> = {};
  for (let r = 0; r < 3; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell && cell.v) metadata[`row${r + 1}`] = String(cell.v);
  }

  // Row 4 (0-indexed 3) has headers
  const headerRow = 3;
  const headers: { col: number; text: string }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = sheet[addr];
    if (cell && cell.v != null) {
      headers.push({ col: c, text: String(cell.v).trim() });
    }
  }

  // Classify columns by header text
  const classified = classifyGlobalMeetColumns(headers);

  // Build questions
  const questions: ParsedQuestion[] = [];
  for (const q of classified.pretestQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.headerText,
      questionType: "assessment",
    });
  }

  // Parse learner data from row 5 onward (0-indexed row 4)
  const learners: ParsedLearner[] = [];
  let excludedCount = 0;
  const dataStartRow = 4;

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const getCellValue = (col: number): string | null => {
      if (col < 0) return null;
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = sheet[addr];
      if (!cell || cell.v == null || cell.v === "") return null;
      return String(cell.v).trim();
    };
    const getCellRaw = (col: number): unknown => {
      if (col < 0) return null;
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = sheet[addr];
      return cell?.v ?? null;
    };

    const email = getCellValue(classified.emailCol);
    if (!email) continue;

    // Duration filter: exclude < 2 minutes
    if (classified.totalDurationCol >= 0) {
      const duration = getCellRaw(classified.totalDurationCol);
      if (duration != null && typeof duration === "number" && duration < MIN_DURATION) {
        excludedCount++;
        warnings.push({
          type: "exclusion",
          message: `Excluded: Total Duration < 2 min`,
          context: email,
        });
        continue;
      }
    }

    const firstName = getCellValue(classified.firstNameCol);
    const lastName = getCellValue(classified.lastNameCol);
    const employer = getCellValue(classified.employerCol);

    // Demographics
    const demographics: Record<string, string | null> = {};
    for (const demo of classified.demographicCols) {
      demographics[demo.name] = getCellValue(demo.col);
    }

    // Assessment responses
    const responses: ParsedLearnerResponse[] = [];

    for (const q of classified.pretestQuestions) {
      const preAnswer = getCellValue(q.preCol);
      if (preAnswer != null) {
        responses.push({
          questionNumber: q.questionNumber,
          phase: "pre",
          learnerAnswer: preAnswer,
          isCorrect: null, // Needs answer key
          numericValue: null,
        });
      }

      // Find matching posttest question
      const postQ = classified.posttestQuestions.find((p) => p.questionNumber === q.questionNumber);
      if (postQ) {
        const postAnswer = getCellValue(postQ.col);
        if (postAnswer != null) {
          responses.push({
            questionNumber: q.questionNumber,
            phase: "post",
            learnerAnswer: postAnswer,
            isCorrect: null, // Needs answer key
            numericValue: null,
          });
        }
      }
    }

    // Presenter Q&A pairs
    const presenterResponses: ParsedPresenterResponse[] = [];
    for (const qa of classified.presenterQA) {
      const question = getCellValue(qa.questionCol);
      const answer = getCellValue(qa.answerCol);
      if (question || answer) {
        presenterResponses.push({
          questionNumber: qa.num,
          questionText: question || "",
          responseText: answer,
        });
      }
    }

    // Aggregates (scores will be null until answer key is applied)
    const preAssessment = responses.filter((r) => r.phase === "pre");
    const postAssessment = responses.filter((r) => r.phase === "post");
    const preScore = computeAssessmentScore(preAssessment);
    const postScore = computeAssessmentScore(postAssessment);

    learners.push({
      email,
      firstName,
      lastName,
      employer,
      practiceSetting: demographics["Practice Type"] ?? demographics["practice_type"] ?? null,
      role: demographics["Role"] ?? demographics["role"] ?? null,
      demographics,
      responses,
      evaluationResponses: [],
      presenterResponses,
      preScore,
      postScore,
      scoreChange: preScore != null && postScore != null ? postScore - preScore : null,
      preConfidenceAvg: null,
      postConfidenceAvg: null,
      confidenceChange: null,
      comments: null,
    });
  }

  // Extract suggested activity name from event title
  const eventTitleCell = sheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  const suggestedName = eventTitleCell?.v ? String(eventTitleCell.v).trim() : null;

  return {
    source: "globalmeet",
    sourceFileName: fileName,
    suggestedActivityName: suggestedName,
    questions,
    learners,
    warnings,
    excludedCount,
    metadata,
  };
}

/**
 * Merge multiple GlobalMeet files (multi-broadcast) into a single ParsedActivityData.
 * Deduplicates learners by email — keeps the first occurrence.
 */
export function mergeGlobalMeetFiles(files: ParsedActivityData[]): ParsedActivityData {
  if (files.length === 0) return emptyResult("", []);
  if (files.length === 1) return files[0];

  const merged = { ...files[0] };
  merged.warnings = [...files[0].warnings];
  merged.excludedCount = files.reduce((sum, f) => sum + f.excludedCount, 0);

  const seenEmails = new Set<string>();
  const allLearners: ParsedLearner[] = [];

  for (const file of files) {
    for (const learner of file.learners) {
      const emailLower = learner.email.toLowerCase();
      if (!seenEmails.has(emailLower)) {
        seenEmails.add(emailLower);
        allLearners.push(learner);
      } else {
        merged.warnings.push({
          type: "data_quality",
          message: `Duplicate email across broadcasts, using first occurrence`,
          context: learner.email,
        });
      }
    }
  }

  merged.learners = allLearners;
  merged.sourceFileName = files.map((f) => f.sourceFileName).join(" + ");
  return merged;
}

interface ClassifiedGMColumns {
  emailCol: number;
  firstNameCol: number;
  lastNameCol: number;
  employerCol: number;
  totalDurationCol: number;
  demographicCols: { col: number; name: string }[];
  pretestQuestions: { questionNumber: number; headerText: string; preCol: number }[];
  posttestQuestions: { questionNumber: number; headerText: string; col: number }[];
  presenterQA: { num: number; questionCol: number; answerCol: number }[];
}

function classifyGlobalMeetColumns(headers: { col: number; text: string }[]): ClassifiedGMColumns {
  const result: ClassifiedGMColumns = {
    emailCol: -1,
    firstNameCol: -1,
    lastNameCol: -1,
    employerCol: -1,
    totalDurationCol: -1,
    demographicCols: [],
    pretestQuestions: [],
    posttestQuestions: [],
    presenterQA: [],
  };

  const questionCols = new Map<number, number>(); // question num → col
  const answerCols = new Map<number, number>(); // answer num → col

  for (const h of headers) {
    const lower = h.text.toLowerCase();

    if (lower === "email" || lower === "email address") {
      result.emailCol = h.col;
    } else if (/^first\s*name$/i.test(h.text)) {
      result.firstNameCol = h.col;
    } else if (/^last\s*name$/i.test(h.text)) {
      result.lastNameCol = h.col;
    } else if (/^employer$/i.test(h.text)) {
      result.employerCol = h.col;
    } else if (/^total\s*duration$/i.test(h.text)) {
      result.totalDurationCol = h.col;
    }

    // Survey pretest: "Survey: Pretest Question N:"
    const preMatch = h.text.match(/survey:\s*pretest\s*question\s*(\d+)/i);
    if (preMatch) {
      result.pretestQuestions.push({
        questionNumber: parseInt(preMatch[1]),
        headerText: h.text,
        preCol: h.col,
      });
      continue;
    }

    // Survey posttest: "Survey: Posttest Question N:"
    const postMatch = h.text.match(/survey:\s*posttest\s*question\s*(\d+)/i);
    if (postMatch) {
      result.posttestQuestions.push({
        questionNumber: parseInt(postMatch[1]),
        headerText: h.text,
        col: h.col,
      });
      continue;
    }

    // Presenter Q&A pairs: "Question N" / "Answer N"
    const qMatch = h.text.match(/^question\s*(\d+)$/i);
    if (qMatch) {
      questionCols.set(parseInt(qMatch[1]), h.col);
      continue;
    }
    const aMatch = h.text.match(/^answer\s*(\d+)$/i);
    if (aMatch) {
      answerCols.set(parseInt(aMatch[1]), h.col);
      continue;
    }

    // Demographic fields
    if (/^(role|percentage\s*practice|practice\s*type|region|title|country|state)$/i.test(h.text)) {
      result.demographicCols.push({ col: h.col, name: h.text });
    }
  }

  // Pair question/answer columns
  for (const [num, qCol] of questionCols) {
    const aCol = answerCols.get(num);
    if (aCol != null) {
      result.presenterQA.push({ num, questionCol: qCol, answerCol: aCol });
    }
  }

  return result;
}

function emptyResult(fileName: string, warnings: ParseWarning[]): ParsedActivityData {
  return {
    source: "globalmeet",
    sourceFileName: fileName,
    suggestedActivityName: null,
    questions: [],
    learners: [],
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}
