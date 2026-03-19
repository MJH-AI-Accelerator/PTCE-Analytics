import * as XLSX from "xlsx";
import type {
  ParsedActivityData,
  ParsedLearner,
  ParsedQuestion,
  ParsedLearnerResponse,
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
 * Parse Pigeonhole pre and post test files.
 * Accepts TWO files (pretest + posttest); uses "Poll By Users" tab.
 * Checkbox matrix format: Q{n}: {answer text} columns with ✓ marks.
 */
export function parsePigeonholeFiles(
  preBuffer: ArrayBuffer,
  postBuffer: ArrayBuffer,
  preFileName: string,
  postFileName: string
): ParsedActivityData {
  const warnings: ParseWarning[] = [];

  const preLearners = parsePollByUsers(preBuffer, "pre", warnings);
  const postLearners = parsePollByUsers(postBuffer, "post", warnings);

  // Merge pre + post by email
  const mergedMap = new Map<string, ParsedLearner>();

  // Process pretest learners
  for (const learner of preLearners.learners) {
    const emailLower = learner.email.toLowerCase();
    mergedMap.set(emailLower, { ...learner });
  }

  // Merge posttest data
  for (const postLearner of postLearners.learners) {
    const emailLower = postLearner.email.toLowerCase();
    const existing = mergedMap.get(emailLower);

    if (existing) {
      // Merge post responses into existing
      existing.responses.push(...postLearner.responses);
      // Recompute aggregates after merge
      recomputeAggregates(existing, [...preLearners.questions, ...postLearners.questions]);
    } else {
      // Post-only learner: null for pre and demographics
      mergedMap.set(emailLower, {
        ...postLearner,
        demographics: {},
        practiceSetting: null,
        role: null,
      });
    }
  }

  // Merge questions from both files, deduplicating by question number
  const allQuestions: ParsedQuestion[] = [...preLearners.questions];
  for (const q of postLearners.questions) {
    if (!allQuestions.some((aq) => aq.questionNumber === q.questionNumber && aq.questionType === q.questionType)) {
      allQuestions.push(q);
    }
  }

  const suggestedName = preLearners.metadata.eventName ?? postLearners.metadata.eventName ?? null;

  return {
    source: "pigeonhole",
    sourceFileName: `${preFileName} + ${postFileName}`,
    suggestedActivityName: suggestedName,
    questions: allQuestions,
    learners: Array.from(mergedMap.values()),
    warnings,
    excludedCount: 0,
    metadata: {
      ...preLearners.metadata,
      preFile: preFileName,
      postFile: postFileName,
    },
  };
}

interface PollByUsersResult {
  questions: ParsedQuestion[];
  learners: ParsedLearner[];
  metadata: Record<string, string>;
}

function parsePollByUsers(
  buffer: ArrayBuffer,
  phase: "pre" | "post",
  warnings: ParseWarning[]
): PollByUsersResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets["Poll By Users"] ?? workbook.Sheets[workbook.SheetNames.find((s) => /poll\s*by\s*users/i.test(s)) || ""];
  if (!sheet) {
    warnings.push({ type: "format", message: `'Poll By Users' sheet not found in ${phase}test file` });
    return { questions: [], learners: [], metadata: {} };
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  // Extract metadata from rows 1-4
  const metadata: Record<string, string> = {};
  for (let r = 0; r < 4 && r <= range.e.r; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell && cell.v) {
      const val = String(cell.v).trim();
      if (r === 1) metadata.eventName = val;
    }
  }

  // Row 6 (0-indexed 5) has column headers
  const headerRow = 5;
  const headers: { col: number; text: string }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = sheet[addr];
    if (cell && cell.v != null) {
      headers.push({ col: c, text: String(cell.v).trim() });
    }
  }

  // Fixed identity columns (0-4): Date/Time, Name, Email, Phone, Employer
  const emailCol = headers.find((h) => /email/i.test(h.text))?.col ?? 2;
  const nameCol = headers.find((h) => /^name$/i.test(h.text))?.col ?? 1;
  const employerCol = headers.find((h) => /employer/i.test(h.text))?.col ?? 4;

  // Identify Q-prefixed columns: "Q{n}: {answer text}"
  const questionColumns: Map<number, { col: number; answerText: string }[]> = new Map();

  for (const h of headers) {
    const match = h.text.match(/^Q(\d+):\s*(.+)/);
    if (match) {
      const qNum = parseInt(match[1]);
      const answerText = match[2].trim();
      if (!questionColumns.has(qNum)) questionColumns.set(qNum, []);
      questionColumns.get(qNum)!.push({ col: h.col, answerText });
    }
  }

  // Build questions
  const questions: ParsedQuestion[] = [];
  for (const [qNum] of [...questionColumns.entries()].sort((a, b) => a[0] - b[0])) {
    // We don't know the question text from Pigeonhole — just the answer options
    questions.push({
      questionNumber: qNum,
      questionText: `Question ${qNum}`,
      questionType: "assessment", // Default; will be refined with survey doc
    });
  }

  // Parse learner data from row 7 onward (0-indexed row 6)
  const learners: ParsedLearner[] = [];
  const dataStartRow = 6;

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const getCellValue = (col: number): string | null => {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = sheet[addr];
      if (!cell || cell.v == null || cell.v === "") return null;
      return String(cell.v).trim();
    };

    const email = getCellValue(emailCol);
    if (!email) continue;

    const fullName = getCellValue(nameCol);
    const nameParts = splitName(fullName);
    const employer = getCellValue(employerCol);

    // Reconstruct answers from checkbox matrix
    const responses: ParsedLearnerResponse[] = [];
    const demographics: Record<string, string | null> = {};

    for (const [qNum, answerCols] of questionColumns) {
      // Scan for ✓ marks
      const selectedAnswers: string[] = [];
      for (const ac of answerCols) {
        const val = getCellValue(ac.col);
        if (val === "✓" || val === "✔" || val === "√") {
          selectedAnswers.push(ac.answerText);
        }
      }

      if (selectedAnswers.length > 0) {
        // Store the reconstructed answer
        responses.push({
          questionNumber: qNum,
          phase,
          learnerAnswer: selectedAnswers.join("; "),
          isCorrect: null, // Needs answer key
          numericValue: null,
        });
      }
    }

    learners.push({
      email,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      employer,
      practiceSetting: null,
      role: null,
      demographics,
      responses,
      evaluationResponses: [],
      presenterResponses: [],
      preScore: null,
      postScore: null,
      scoreChange: null,
      preConfidenceAvg: null,
      postConfidenceAvg: null,
      confidenceChange: null,
      comments: null,
    });
  }

  return { questions, learners, metadata };
}

function splitName(fullName: string | null): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function recomputeAggregates(learner: ParsedLearner, questions: ParsedQuestion[]): void {
  const preAssessment = learner.responses.filter(
    (r) => r.phase === "pre" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "assessment"
  );
  const postAssessment = learner.responses.filter(
    (r) => r.phase === "post" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "assessment"
  );
  const preConfidence = learner.responses.filter(
    (r) => r.phase === "pre" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "confidence"
  );
  const postConfidence = learner.responses.filter(
    (r) => r.phase === "post" && questions.find((q) => q.questionNumber === r.questionNumber)?.questionType === "confidence"
  );

  learner.preScore = computeAssessmentScore(preAssessment);
  learner.postScore = computeAssessmentScore(postAssessment);
  learner.scoreChange = learner.preScore != null && learner.postScore != null ? learner.postScore - learner.preScore : null;
  learner.preConfidenceAvg = confidenceAverage(preConfidence.map((r) => r.numericValue));
  learner.postConfidenceAvg = confidenceAverage(postConfidence.map((r) => r.numericValue));
  learner.confidenceChange = confidenceChange(learner.preConfidenceAvg, learner.postConfidenceAvg);
}
