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

/**
 * Parse an Array report Excel file.
 * Expected sheets: Survey, Survey Summary, Reportable Participants, optionally Presenter Questions.
 *
 * Header structure (multi-row):
 *   Row 3: Section headers (Email, First Name, Demographics, Pre/Post, ARS, Pulse, etc.)
 *   Row 4: Sub-group labels (Demo - Employer, Pre/Post 1, Pre/Post 2, Confidence, ARS 1, etc.)
 *   Row 5: Full question text
 *   Row 7: Phase indicators (In-Meeting (Pre) / In-Meeting (Post))
 *   Row 8: "Clarification Text" markers for "Other" demographic fields
 *   Row 9+: Learner data
 *
 * Correct answers detected via #B5E09B cell background (fgColor.rgb).
 */
export function parseArrayFile(buffer: ArrayBuffer, fileName: string): ParsedActivityData {
  const workbook = XLSX.read(buffer, { type: "array", cellStyles: true });
  const warnings: ParseWarning[] = [];

  const surveySheet = workbook.Sheets["Survey"];
  if (!surveySheet) {
    return emptyResult(fileName, [{ type: "format", message: "'Survey' sheet not found" }]);
  }

  const range = XLSX.utils.decode_range(surveySheet["!ref"] || "A1");

  // Read all header rows
  const getCell = (r: number, c: number) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    return surveySheet[addr];
  };
  const getCellValue = (r: number, c: number): string => {
    const cell = getCell(r, c);
    return cell && cell.v != null ? String(cell.v).trim() : "";
  };

  // Classify columns using multi-row header structure
  const classified = classifyColumns(range, getCellValue);

  // Detect answer key from #B5E09B cell highlighting
  const answerKeyMap = detectAnswerKey(surveySheet, range, classified);

  // Build questions
  const questions: ParsedQuestion[] = [];

  for (const q of classified.assessmentQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: "assessment",
      correctAnswer: answerKeyMap.get(q.questionNumber),
    });
  }

  for (const q of classified.confidenceQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: "confidence",
    });
  }

  for (const q of classified.arsQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: "ars",
    });
  }

  for (const q of classified.pulseQuestions) {
    questions.push({
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: "pulse",
    });
  }

  // Parse learner data from row 9 onward (0-indexed row 8)
  const learners: ParsedLearner[] = [];
  const dataStartRow = 8;

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const getVal = (col: number): string | null => {
      if (col < 0) return null;
      const cell = getCell(r, col);
      if (!cell || cell.v == null || cell.v === "") return null;
      return String(cell.v).trim();
    };

    const email = getVal(classified.emailCol);
    if (!email) continue;

    const firstName = getVal(classified.firstNameCol);
    const lastName = getVal(classified.lastNameCol);
    const employer = getVal(classified.employerCol);

    // Demographics
    const demographics: Record<string, string | null> = {};
    for (const demo of classified.demographicCols) {
      let value = getVal(demo.col);
      // Merge "Other" + clarification text
      if (value?.toLowerCase() === "other" && demo.clarificationCol >= 0) {
        const clarification = getVal(demo.clarificationCol);
        if (clarification) {
          value = `Other (${clarification})`;
        }
      }
      demographics[demo.name] = value;
    }

    // Assessment responses
    const responses: ParsedLearnerResponse[] = [];

    for (const q of classified.assessmentQuestions) {
      const preAnswer = getVal(q.preCol);
      const postAnswer = q.postCol >= 0 ? getVal(q.postCol) : null;
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
      const preAnswer = getVal(q.preCol);
      const postAnswer = q.postCol >= 0 ? getVal(q.postCol) : null;

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
      const answer = getVal(q.col);
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
      const answer = getVal(q.col);
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
    const preAssessment = responses.filter(
      (r) => r.phase === "pre" && classified.assessmentQuestions.some((q) => q.questionNumber === r.questionNumber)
    );
    const postAssessment = responses.filter(
      (r) => r.phase === "post" && classified.assessmentQuestions.some((q) => q.questionNumber === r.questionNumber)
    );
    const preConfidence = responses.filter(
      (r) => r.phase === "pre" && classified.confidenceQuestions.some((q) => q.questionNumber === r.questionNumber)
    );
    const postConfidence = responses.filter(
      (r) => r.phase === "post" && classified.confidenceQuestions.some((q) => q.questionNumber === r.questionNumber)
    );

    const preScore = computeAssessmentScore(preAssessment);
    const postScore = computeAssessmentScore(postAssessment);
    const preConfAvg = confidenceAverage(preConfidence.map((r) => r.numericValue));
    const postConfAvg = confidenceAverage(postConfidence.map((r) => r.numericValue));

    learners.push({
      email,
      firstName,
      lastName,
      employer,
      practiceSetting: demographics["Practice Focus"] ?? demographics["Practice Type"] ?? null,
      role: demographics["Position"] ?? null,
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
      comments: null,
    });
  }

  // Parse presenter questions tab
  const presenterSheet = workbook.Sheets["Presenter Questions"];
  if (presenterSheet) {
    parsePresenterQuestions(presenterSheet, learners);
  }

  // Extract activity name from row 2
  let suggestedName: string | null = null;
  const titleVal = getCellValue(1, 1); // Row 2, Col B
  if (titleVal) {
    // Strip "Survey - " prefix if present
    suggestedName = titleVal.replace(/^Survey\s*-\s*/i, "").trim();
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

// --- Column classification ---

interface AssessmentQuestion {
  questionNumber: number;
  questionText: string;
  preCol: number;
  postCol: number;
}

interface ConfidenceQuestion {
  questionNumber: number;
  questionText: string;
  preCol: number;
  postCol: number;
}

interface SingleColQuestion {
  questionNumber: number;
  questionText: string;
  col: number;
}

interface DemographicCol {
  col: number;
  name: string;
  clarificationCol: number;
}

interface ClassifiedColumns {
  emailCol: number;
  firstNameCol: number;
  lastNameCol: number;
  employerCol: number;
  demographicCols: DemographicCol[];
  assessmentQuestions: AssessmentQuestion[];
  confidenceQuestions: ConfidenceQuestion[];
  arsQuestions: SingleColQuestion[];
  pulseQuestions: SingleColQuestion[];
}

function classifyColumns(
  range: XLSX.Range,
  getCellValue: (r: number, c: number) => string
): ClassifiedColumns {
  const result: ClassifiedColumns = {
    emailCol: -1,
    firstNameCol: -1,
    lastNameCol: -1,
    employerCol: -1,
    demographicCols: [],
    assessmentQuestions: [],
    confidenceQuestions: [],
    arsQuestions: [],
    pulseQuestions: [],
  };

  // Row indices (0-indexed)
  const ROW_SECTION = 2;   // Row 3: section headers
  const ROW_SUBLABEL = 3;  // Row 4: sub-group labels
  const ROW_QTEXT = 4;     // Row 5: question text
  const ROW_PHASE = 6;     // Row 7: phase (Pre/Post)
  const ROW_CLARIF = 7;    // Row 8: clarification markers

  // Track which section we're in
  let currentSection = "";
  let assessmentNum = 0;
  let confidenceNum = 0;
  let arsNum = 0;
  let pulseNum = 0;

  for (let c = 0; c <= range.e.c; c++) {
    const sectionHeader = getCellValue(ROW_SECTION, c);
    const subLabel = getCellValue(ROW_SUBLABEL, c);
    const questionText = getCellValue(ROW_QTEXT, c);
    const phase = getCellValue(ROW_PHASE, c);
    const clarif = getCellValue(ROW_CLARIF, c);

    // Update section from row 3
    if (sectionHeader) {
      if (/email/i.test(sectionHeader)) {
        result.emailCol = c;
        continue;
      }
      if (/first\s*name/i.test(sectionHeader)) {
        result.firstNameCol = c;
        continue;
      }
      if (/last\s*name/i.test(sectionHeader)) {
        result.lastNameCol = c;
        continue;
      }
      if (/demographics/i.test(sectionHeader)) {
        currentSection = "demographics";
      } else if (/pre\/post/i.test(sectionHeader)) {
        currentSection = "prepost";
      } else if (/^ars$/i.test(sectionHeader.trim())) {
        currentSection = "ars";
      } else if (/pulse/i.test(sectionHeader)) {
        currentSection = "pulse";
      }
      // Skip metadata columns (Registration ID, Display Name, Total, Correct %)
      if (/registration|display|total|correct\s*%/i.test(sectionHeader)) {
        continue;
      }
    }

    // Process based on current section
    if (currentSection === "demographics") {
      if (subLabel && /demo\s*-/i.test(subLabel)) {
        const demoName = subLabel.replace(/^demo\s*-\s*/i, "").trim();
        if (/employer/i.test(demoName)) {
          result.employerCol = c;
        }
        // Check if next column is "Clarification Text"
        const nextClarif = getCellValue(ROW_CLARIF, c + 1);
        const clarifCol = nextClarif.toLowerCase() === "clarification text" ? c + 1 : -1;

        result.demographicCols.push({
          col: c,
          name: demoName,
          clarificationCol: clarifCol,
        });
      }
      // Skip clarification text columns (they're referenced by the previous demo col)
      if (clarif.toLowerCase() === "clarification text") continue;
    }

    if (currentSection === "prepost") {
      // Sub-label tells us which question group (Pre/Post 1, Pre/Post 2, Confidence)
      if (subLabel) {
        const prepostMatch = subLabel.match(/pre\/post\s*(\d+)/i);
        const isConfidence = /confidence/i.test(subLabel);

        if (prepostMatch) {
          assessmentNum++;
          const qNum = assessmentNum;
          // This column is the Pre col; next column (with Post phase) is the Post col
          const nextPhase = getCellValue(ROW_PHASE, c + 1);
          const postCol = /post/i.test(nextPhase) ? c + 1 : -1;

          result.assessmentQuestions.push({
            questionNumber: qNum,
            questionText: questionText || `Assessment Question ${qNum}`,
            preCol: c,
            postCol,
          });
        } else if (isConfidence) {
          confidenceNum++;
          const qNum = 1000 + confidenceNum;
          const nextPhase = getCellValue(ROW_PHASE, c + 1);
          const postCol = /post/i.test(nextPhase) ? c + 1 : -1;

          result.confidenceQuestions.push({
            questionNumber: qNum,
            questionText: questionText || `Confidence Question ${confidenceNum}`,
            preCol: c,
            postCol,
          });
        }
      }
      // Skip Post columns (already captured as postCol above)
      if (!subLabel && /post/i.test(phase)) continue;
    }

    if (currentSection === "ars") {
      if (subLabel && /ars/i.test(subLabel)) {
        arsNum++;
        result.arsQuestions.push({
          questionNumber: 2000 + arsNum,
          questionText: questionText || `ARS Question ${arsNum}`,
          col: c,
        });
      }
    }

    if (currentSection === "pulse") {
      if (subLabel || sectionHeader) {
        pulseNum++;
        result.pulseQuestions.push({
          questionNumber: 3000 + pulseNum,
          questionText: questionText || `Pulse Question ${pulseNum}`,
          col: c,
        });
      }
    }
  }

  return result;
}

// --- Answer key detection ---

function detectAnswerKey(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
  classified: ClassifiedColumns
): Map<number, string> {
  const answerKeyMap = new Map<number, string>();

  // Scan data rows for #B5E09B highlighted cells in assessment columns
  const assessmentCols = new Set<number>();
  for (const q of classified.assessmentQuestions) {
    assessmentCols.add(q.preCol);
    if (q.postCol >= 0) assessmentCols.add(q.postCol);
  }

  // For each assessment question, find the correct answer from highlighted cells
  for (const q of classified.assessmentQuestions) {
    // Check pre column cells for highlighting
    for (let r = 8; r <= range.e.r; r++) {
      const preAddr = XLSX.utils.encode_cell({ r, c: q.preCol });
      const preCell = sheet[preAddr];
      if (preCell && isB5E09B(preCell)) {
        const answer = String(preCell.v || "").trim();
        if (answer && !answerKeyMap.has(q.questionNumber)) {
          answerKeyMap.set(q.questionNumber, answer);
          break;
        }
      }
    }

    // If not found in pre, check post column
    if (!answerKeyMap.has(q.questionNumber) && q.postCol >= 0) {
      for (let r = 8; r <= range.e.r; r++) {
        const postAddr = XLSX.utils.encode_cell({ r, c: q.postCol });
        const postCell = sheet[postAddr];
        if (postCell && isB5E09B(postCell)) {
          const answer = String(postCell.v || "").trim();
          if (answer && !answerKeyMap.has(q.questionNumber)) {
            answerKeyMap.set(q.questionNumber, answer);
            break;
          }
        }
      }
    }
  }

  return answerKeyMap;
}

function isB5E09B(cell: XLSX.CellObject): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = cell.s as any;
  if (!s) return false;
  if (s.patternType !== "solid") return false;
  const rgb = s.fgColor?.rgb || "";
  return rgb.toUpperCase() === "B5E09B" || rgb.toUpperCase() === "FFB5E09B";
}

// --- Presenter questions ---

function parsePresenterQuestions(sheet: XLSX.WorkSheet, learners: ParsedLearner[]): void {
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (jsonData.length === 0) return;

  const headers = Object.keys(jsonData[0]);
  const emailCol = headers.find((h) => /email/i.test(h));
  if (!emailCol) return;

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

function emptyResult(fileName: string, warnings: ParseWarning[]): ParsedActivityData {
  return {
    source: "array",
    sourceFileName: fileName,
    suggestedActivityName: null,
    questions: [],
    learners: [],
    warnings,
    excludedCount: 0,
    metadata: {},
  };
}
