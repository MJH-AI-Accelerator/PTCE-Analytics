import * as XLSX from "xlsx";
import Fuse from "fuse.js";
import type { AnswerKeyEntry, ParsedQuestion } from "./types";

/**
 * Extract answer key from Array file cell highlighting (#B5E09B).
 * Reads the "Survey" sheet with cellStyles and detects green-highlighted cells.
 */
export function extractAnswerKeyFromHighlighting(
  buffer: ArrayBuffer,
  sheetName: string = "Survey"
): AnswerKeyEntry[] {
  const workbook = XLSX.read(buffer, { type: "array", cellStyles: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const entries: AnswerKeyEntry[] = [];

  // Find assessment question columns by checking row headers (row 8, 0-indexed row 7)
  // Detect columns that contain pre/post assessment answers
  // Group columns by question number, find the one with #B5E09B background

  // First, identify question columns from headers
  const headerRow = 7; // 0-indexed, row 8 in the file
  const questionColumns: Map<number, { col: number; text: string }[]> = new Map();

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = sheet[addr];
    if (!cell || !cell.v) continue;

    const header = String(cell.v);
    // Match patterns like "Pre Question 1", "Post Question 1", etc.
    const match = header.match(/(?:pre|post)\s*(?:test\s*)?(?:question|q)\s*(\d+)/i);
    if (match) {
      const qNum = parseInt(match[1]);
      if (!questionColumns.has(qNum)) questionColumns.set(qNum, []);
      questionColumns.get(qNum)!.push({ col: c, text: header });
    }
  }

  // Scan data rows for #B5E09B highlighted cells
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (!cell) continue;

      // Check for green highlight
      if (isCorrectHighlight(cell)) {
        // Find which question this column belongs to
        const headerAddr = XLSX.utils.encode_cell({ r: headerRow, c });
        const headerCell = sheet[headerAddr];
        if (!headerCell) continue;

        const headerText = String(headerCell.v || "");
        const qMatch = headerText.match(/(?:pre|post)\s*(?:test\s*)?(?:question|q)\s*(\d+)/i);
        if (qMatch) {
          const qNum = parseInt(qMatch[1]);
          const answer = String(cell.v || "").trim();
          if (answer && !entries.some((e) => e.questionNumber === qNum)) {
            entries.push({
              questionNumber: qNum,
              correctAnswer: answer,
            });
          }
        }
      }
    }
  }

  return entries;
}

/** Check if a cell has the #B5E09B background color indicating a correct answer. */
function isCorrectHighlight(cell: XLSX.CellObject): boolean {
  const style = cell.s;
  if (!style) return false;

  // SheetJS stores fill info in the style object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = style as any;
  const fill = s.fill || s.patternFill;
  if (!fill) return false;

  const fgColor = fill.fgColor || fill.bgColor;
  if (!fgColor) return false;

  const rgb = (fgColor.rgb || fgColor.argb || "").toUpperCase();
  // Match B5E09B with or without alpha prefix
  return rgb === "B5E09B" || rgb === "FFB5E09B" || rgb.endsWith("B5E09B");
}

/**
 * Apply answer key entries to parsed questions, matching by question number
 * or by fuzzy text matching.
 */
export function applyAnswerKey(
  questions: ParsedQuestion[],
  answerKey: AnswerKeyEntry[]
): ParsedQuestion[] {
  // First pass: match by question number
  const unmatchedKeys: AnswerKeyEntry[] = [];
  const matchedQuestionNums = new Set<number>();

  for (const key of answerKey) {
    if (key.questionNumber != null) {
      const q = questions.find((q) => q.questionNumber === key.questionNumber);
      if (q) {
        if (key.correctAnswer) q.correctAnswer = key.correctAnswer;
        if (key.questionCategory) q.questionCategory = key.questionCategory;
        if (key.questionType) q.questionType = key.questionType;
        matchedQuestionNums.add(q.questionNumber);
        continue;
      }
    }
    unmatchedKeys.push(key);
  }

  // Second pass: fuzzy match by question text for remaining
  if (unmatchedKeys.length > 0) {
    const unmatchedQuestions = questions.filter((q) => !matchedQuestionNums.has(q.questionNumber) && q.questionText);
    if (unmatchedQuestions.length > 0) {
      const fuse = new Fuse(unmatchedQuestions, {
        keys: ["questionText"],
        threshold: 0.4,
        includeScore: true,
      });

      for (const key of unmatchedKeys) {
        if (!key.questionText) continue;
        const results = fuse.search(key.questionText);
        if (results.length > 0 && results[0].score! < 0.4) {
          const q = results[0].item;
          if (key.correctAnswer) q.correctAnswer = key.correctAnswer;
          if (key.questionCategory) q.questionCategory = key.questionCategory;
          if (key.questionType) q.questionType = key.questionType;
        }
      }
    }
  }

  return questions;
}
