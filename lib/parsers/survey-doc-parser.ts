import mammoth from "mammoth";
import type { AnswerKeyEntry, QuestionType } from "./types";

/**
 * Standard question categories — assigned based on what competency the question assesses.
 * Focus on what the question is TESTING, not what medical topic it mentions.
 */
const CATEGORY_RULES: { category: string; patterns: RegExp[] }[] = [
  {
    category: "Disease Burden",
    patterns: [
      /epidemiology|prevalence|incidence/i,
      /disease\s*burden/i,
      /risk\s*(?:period|factor|population)/i,
      /morbidity|mortality/i,
      /impact\s*(?:on|of)/i,
      /how\s*(?:common|frequent|many\s*patients)/i,
    ],
  },
  {
    category: "Pathophysiology and Mechanism of Action",
    patterns: [
      /mechanism\s*of\s*action/i,
      /pharmacology/i,
      /formulation/i,
      /degrader|PROTAC|inhibitor.*mechanism/i,
      /biological\s*pathway/i,
      /drug\s*(?:mechanism|property|properties)/i,
      /how\s*(?:does|do)\s*(?:the|this)\s*(?:drug|agent|therapy)\s*work/i,
    ],
  },
  {
    category: "Clinical Updates",
    patterns: [
      /demonstrated\s*a\s*(?:PFS|OS|ORR|DFS|IDFS|DRFS)/i,
      /(?:trial|study)\s*(?:showed|demonstrated|reported)/i,
      /(?:PFS|OS|ORR|DFS)\s*(?:improvement|benefit|prolongation)/i,
      /outcomes?\s*(?:were|was)\s*observed/i,
      /compared\s*(?:with|to)\s*(?:standard|placebo|control)/i,
      /(?:new|recent|emerging)\s*(?:data|evidence|trial|study)/i,
      /guideline\s*(?:change|update|recommendation)/i,
      /abstract|SABCS|ASCO|ESMO/i,
    ],
  },
  {
    category: "Role of the Pharmacist",
    patterns: [
      /(?:pharmacist|health\s*care\s*team)\s*should/i,
      /before\s*initiating\s*therapy/i,
      /confirm\s*(?:the\s*)?presence/i,
      /role\s*(?:of\s*)?(?:the\s*)?pharmacist/i,
      /pharmacist.s?\s*(?:role|responsibility|action)/i,
      /what\s*(?:should|would)\s*(?:the|a)\s*pharmacist/i,
      /clinical\s*(?:decision|action)\s*(?:by|for)\s*(?:the\s*)?(?:pharmacist|team)/i,
    ],
  },
  {
    category: "Patient Recommendations",
    patterns: [
      /recommend|recommendation/i,
      /treatment\s*(?:selection|option|decision)/i,
      /counsel|monitoring/i,
      /(?:dosing|dose)\s*(?:adjustment|decision|change)/i,
      /therapy\s*(?:selection|management|initiation|option)/i,
      /what\s*(?:would|should)\s*you\s*recommend/i,
    ],
  },
];

interface ParsedDocQuestion {
  questionNumber: number;
  questionText: string;
  learningObjective: string | null;
  category: string | null;
  correctAnswer: string | null;
  questionType: QuestionType | null;
}

/**
 * Parse a survey assessment .docx file to extract:
 * - Question numbers and text
 * - Learning objective (LO) mappings
 * - Question categories (derived from question text using competency analysis)
 * - Correct answers (from bold text in answer choices)
 * - Question types (assessment, confidence, ARS, pulse)
 */
export async function parseSurveyAssessmentDoc(
  buffer: ArrayBuffer
): Promise<{ entries: AnswerKeyEntry[]; raw: ParsedDocQuestion[] }> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const html = result.value;

  // Try table-based parsing first (PTCE standard format)
  let questions = parseTableFormat(html);

  // Fallback to paragraph-based parsing if table format yields nothing
  if (questions.length === 0) {
    questions = parseParagraphFormat(html);
  }

  const entries: AnswerKeyEntry[] = questions.map((q) => ({
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    correctAnswer: q.correctAnswer ?? undefined,
    questionCategory: q.category ?? undefined,
    questionType: q.questionType ?? undefined,
  }));

  return { entries, raw: questions };
}

/**
 * Parse the PTCE table format:
 * - Pretest section: questions in table cells with bold text
 * - Posttest section: table with columns [LO#, Question+Answers, Rationale]
 * - Confidence questions: identified by "how confident" text
 * - ARS/Pulse: identified by section labels in the first column
 */
function parseTableFormat(html: string): ParsedDocQuestion[] {
  const questions: ParsedDocQuestion[] = [];

  // Find the posttest section — it has the LO column
  const postIdx = html.indexOf("Posttest question");
  if (postIdx === -1) {
    // Try alternate format: look for LO column header
    return parsePreTestOnly(html);
  }

  const postHtml = html.substring(postIdx);

  // Extract posttest rows: <td><p>LO_NUM</p></td><td>QUESTION_CONTENT</td>
  const rowPattern = /<td><p>(\d+)<\/p><\/td><td>([\s\S]*?)<\/td>/g;
  let match;
  let qNum = 0;

  while ((match = rowPattern.exec(postHtml)) !== null) {
    const loNum = match[1];
    const cellContent = match[2];

    // Extract question text (first bold text block)
    const boldMatch = cellContent.match(/<strong>([\s\S]*?)<\/strong>/);
    if (!boldMatch) continue;

    qNum++;
    const questionText = stripHtml(boldMatch[1]);

    // Skip confidence questions — they get handled separately
    if (/how confident/i.test(questionText)) {
      questions.push({
        questionNumber: qNum,
        questionText,
        learningObjective: `LO ${loNum}`,
        category: null,
        correctAnswer: null,
        questionType: "confidence",
      });
      continue;
    }

    // Find correct answer — look for highlighted/bold answer choice
    // In the posttest table, the correct answer is typically the bold answer choice
    // The question text itself is bold, so we need to find bold text AFTER the question
    const correctAnswer = extractCorrectFromCell(cellContent, questionText);

    // Categorize from question text
    const category = categorizeFromText(questionText);

    questions.push({
      questionNumber: qNum,
      questionText,
      learningObjective: `LO ${loNum}`,
      category,
      correctAnswer,
      questionType: "assessment",
    });
  }

  // Also scan for confidence questions that don't have an LO number
  // (they appear as separate rows without LO)
  const confPattern = /<strong>([\s\S]*?how confident[\s\S]*?)<\/strong>/gi;
  let confMatch;
  while ((confMatch = confPattern.exec(postHtml)) !== null) {
    const confText = stripHtml(confMatch[1]);
    // Check if we already captured this
    if (!questions.some((q) => q.questionType === "confidence")) {
      qNum++;
      questions.push({
        questionNumber: qNum,
        questionText: confText,
        learningObjective: null,
        category: null,
        correctAnswer: null,
        questionType: "confidence",
      });
    }
  }

  // Scan pretest section for ARS and Pulse questions
  const preHtml = html.substring(0, postIdx);
  scanForArsAndPulse(preHtml, questions);

  return questions;
}

/**
 * Fallback: parse when there's no explicit posttest section with LO column.
 */
function parsePreTestOnly(html: string): ParsedDocQuestion[] {
  return parseParagraphFormat(html);
}

/**
 * Scan for ARS and Pulse questions in the HTML.
 */
function scanForArsAndPulse(html: string, questions: ParsedDocQuestion[]): void {
  // ARS questions
  const arsPattern = /ARS[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
  let arsMatch;
  let arsNum = 0;
  while ((arsMatch = arsPattern.exec(html)) !== null) {
    const cellContent = arsMatch[1];
    const boldMatch = cellContent.match(/<strong>([\s\S]*?)<\/strong>/);
    if (boldMatch) {
      arsNum++;
      questions.push({
        questionNumber: 100 + arsNum, // offset to avoid conflicts
        questionText: stripHtml(boldMatch[1]),
        learningObjective: null,
        category: null,
        correctAnswer: null,
        questionType: "ars",
      });
    }
  }

  // Pulse questions
  const pulsePattern = /Pulse[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
  let pulseMatch;
  let pulseNum = 0;
  while ((pulseMatch = pulsePattern.exec(html)) !== null) {
    const cellContent = pulseMatch[1];
    const boldMatch = cellContent.match(/<strong>([\s\S]*?)<\/strong>/);
    if (boldMatch) {
      pulseNum++;
      questions.push({
        questionNumber: 200 + pulseNum, // offset to avoid conflicts
        questionText: stripHtml(boldMatch[1]),
        learningObjective: null,
        category: null,
        correctAnswer: null,
        questionType: "pulse",
      });
    }
  }
}

/**
 * Extract correct answer from a table cell.
 * The correct answer is typically a bold answer choice after the question text,
 * or highlighted with background color.
 */
function extractCorrectFromCell(cellHtml: string, questionText: string): string | null {
  // Find the position after the question text ends
  const qTextPlain = questionText.substring(0, 40);
  const qIdx = cellHtml.indexOf(qTextPlain);
  if (qIdx === -1) return null;

  // Look at content after the question text
  const afterQuestion = cellHtml.substring(qIdx + qTextPlain.length);

  // Look for bold text that's an answer choice (not the question itself)
  // Answer choices are typically single paragraphs, not full sentences
  const boldAnswers = afterQuestion.match(/<strong>([^<]+)<\/strong>/g);
  if (boldAnswers && boldAnswers.length > 0) {
    for (const ba of boldAnswers) {
      const text = stripHtml(ba);
      // Filter: answer choices are usually shorter than questions
      if (text.length > 5 && text.length < 200 && !text.includes("?")) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Paragraph-based fallback parser for non-table documents.
 */
function parseParagraphFormat(html: string): ParsedDocQuestion[] {
  const questions: ParsedDocQuestion[] = [];
  const paragraphs = html.split(/<\/p>|<br\s*\/?>|<\/li>/).map((p) =>
    stripHtml(p).trim()
  ).filter(Boolean);

  let currentType: QuestionType | null = "assessment";

  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i];

    // Detect section headers
    if (/pre[\s-]*(?:test|assessment)|post[\s-]*(?:test|assessment)/i.test(text) && text.length < 80) {
      currentType = "assessment";
      continue;
    }
    if (/confidence/i.test(text) && text.length < 80) {
      currentType = "confidence";
      continue;
    }
    if (/ars|audience\s*response/i.test(text) && text.length < 60) {
      currentType = "ars";
      continue;
    }
    if (/pulse/i.test(text) && text.length < 60) {
      currentType = "pulse";
      continue;
    }

    // Detect question numbers
    const qMatch = text.match(/^(?:question\s*#?\s*(\d+)|q\s*#?\s*(\d+)|#\s*(\d+)|(\d+)\s*[.):])\s*[:\-–—.]?\s*(.*)/i);
    if (qMatch) {
      const qNum = parseInt(qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4]);
      const qText = (qMatch[5] || "").trim();

      if (qNum > 0 && qNum < 100 && qText.length > 10) {
        questions.push({
          questionNumber: qNum,
          questionText: qText,
          learningObjective: null,
          category: categorizeFromText(qText),
          correctAnswer: null,
          questionType: currentType,
        });
      }
    }
  }

  return questions;
}

/**
 * Categorize a question based on what competency it's assessing.
 * Focus on what the question is TESTING the learner on, not the surface topic.
 */
function categorizeFromText(text: string): string | null {
  for (const { category, patterns } of CATEGORY_RULES) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return category;
    }
  }
  return null;
}

/** Strip HTML tags and decode entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
