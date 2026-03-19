import mammoth from "mammoth";
import type { AnswerKeyEntry, QuestionType } from "./types";

/**
 * Standard question categories mapped from Learning Objectives.
 */
const CATEGORY_KEYWORDS: { category: string; patterns: RegExp[] }[] = [
  {
    category: "Pathophysiology and Mechanism of Action",
    patterns: [
      /pathophysiology/i,
      /mechanism\s*of\s*action/i,
      /pharmacology/i,
      /biological\s*pathway/i,
      /drug\s*mechanism/i,
      /formulation/i,
    ],
  },
  {
    category: "Clinical Updates",
    patterns: [
      /clinical\s*(?:update|trial|data|evidence)/i,
      /guideline\s*change/i,
      /emerging\s*(?:evidence|data|therapy|therapies)/i,
      /new\s*(?:trial|data|evidence)/i,
      /recent\s*(?:study|studies|trial|data)/i,
    ],
  },
  {
    category: "Patient Recommendations",
    patterns: [
      /patient\s*recommendation/i,
      /treatment\s*(?:selection|option|decision|recommendation)/i,
      /counsel/i,
      /monitoring/i,
      /dosing/i,
      /therapy\s*(?:selection|management|initiation)/i,
      /clinical\s*decision/i,
    ],
  },
  {
    category: "Disease Burden",
    patterns: [
      /disease\s*burden/i,
      /epidemiology/i,
      /prevalence/i,
      /incidence/i,
      /impact\s*(?:on|of)/i,
      /morbidity/i,
      /mortality/i,
      /risk\s*factor/i,
    ],
  },
  {
    category: "Role of the Pharmacist",
    patterns: [
      /role\s*(?:of\s*)?(?:the\s*)?pharmacist/i,
      /pharmacist.s?\s*(?:role|responsibility|action)/i,
      /pharmacist-specific/i,
      /pharmacy\s*practice/i,
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
 * - Question categories (derived from LO text)
 * - Correct answers (from bold or highlighted text)
 * - Question types (assessment, confidence, ARS, pulse)
 *
 * Returns AnswerKeyEntry[] for use with applyAnswerKey().
 */
export async function parseSurveyAssessmentDoc(
  buffer: ArrayBuffer
): Promise<{ entries: AnswerKeyEntry[]; raw: ParsedDocQuestion[] }> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        // Preserve bold and highlight styles
        "b => strong",
        "highlight => mark",
      ],
    }
  );

  const html = result.value;
  const questions = extractQuestionsFromHtml(html);

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
 * Extract questions from the HTML output of mammoth.
 * Survey assessment docs typically have structures like:
 * - "Question 1:" or "Q1:" or "1." followed by question text
 * - Learning Objective references like "LO1", "Learning Objective 1", "Maps to LO 2"
 * - Correct answers bolded (<strong>) or highlighted (<mark>)
 * - Section headers for question types (Pre/Post Assessment, Confidence, ARS, Pulse)
 */
function extractQuestionsFromHtml(html: string): ParsedDocQuestion[] {
  const questions: ParsedDocQuestion[] = [];

  // Split HTML into paragraphs
  const paragraphs = html.split(/<\/p>|<br\s*\/?>|<\/li>/).map((p) =>
    p.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim()
  ).filter(Boolean);

  // Also keep the raw HTML paragraphs for bold/highlight detection
  const htmlParagraphs = html.split(/<\/p>|<\/li>/);

  let currentType: QuestionType | null = "assessment";
  let currentLO: string | null = null;

  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i];
    const rawHtml = htmlParagraphs[i] || "";

    // Detect section headers for question type
    if (/pre[\s-]*(?:test|assessment)|post[\s-]*(?:test|assessment)|assessment\s*question/i.test(text) && text.length < 80) {
      currentType = "assessment";
      continue;
    }
    if (/confidence\s*question/i.test(text) && text.length < 80) {
      currentType = "confidence";
      continue;
    }
    if (/(?:ars|audience\s*response)/i.test(text) && text.length < 80) {
      currentType = "ars";
      continue;
    }
    if (/pulse\s*question/i.test(text) && text.length < 80) {
      currentType = "pulse";
      continue;
    }

    // Detect Learning Objective references
    const loMatch = text.match(/(?:learning\s*objective|LO)\s*#?\s*(\d+)\s*[:\-–—]?\s*(.*)/i);
    if (loMatch && text.length < 200) {
      currentLO = loMatch[2]?.trim() || `LO ${loMatch[1]}`;
      continue;
    }

    // Detect question numbers: "Question 1:", "Q1:", "1.", "1)", "#1"
    const qMatch = text.match(/^(?:question\s*#?\s*(\d+)|q\s*#?\s*(\d+)|#\s*(\d+)|(\d+)\s*[.):])\s*[:\-–—.]?\s*(.*)/i);
    if (qMatch) {
      const qNum = parseInt(qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4]);
      const qText = (qMatch[5] || "").trim();

      if (qNum > 0 && qNum < 100) {
        // Look for correct answer in this paragraph or nearby paragraphs
        const correctAnswer = extractCorrectAnswer(rawHtml, htmlParagraphs, i);

        // Determine category from LO text or question text
        const category = currentLO
          ? categorizeFromText(currentLO)
          : categorizeFromText(qText);

        questions.push({
          questionNumber: qNum,
          questionText: qText,
          learningObjective: currentLO,
          category,
          correctAnswer,
          questionType: currentType,
        });
      }
    }
  }

  return questions;
}

/**
 * Extract the correct answer from HTML using bold (<strong>) or highlight (<mark>) tags.
 * Looks at the current paragraph and a few subsequent ones (answer choices).
 */
function extractCorrectAnswer(
  currentHtml: string,
  allParagraphs: string[],
  index: number
): string | null {
  // Check current paragraph and next 6 paragraphs (answer choices typically follow the question)
  for (let offset = 0; offset <= 6 && index + offset < allParagraphs.length; offset++) {
    const html = allParagraphs[index + offset] || "";

    // Look for bold text within answer choice context
    const boldMatch = html.match(/<strong[^>]*>([^<]+)<\/strong>/);
    if (boldMatch) {
      const boldText = boldMatch[1].trim();
      // Check if this looks like an answer (letter prefix or substantive text)
      const choiceMatch = boldText.match(/^([A-E])[.):\s]\s*(.*)/i);
      if (choiceMatch) return choiceMatch[0].trim();
      if (boldText.length > 2 && boldText.length < 300) return boldText;
    }

    // Look for highlighted text
    const markMatch = html.match(/<mark[^>]*>([^<]+)<\/mark>/);
    if (markMatch) {
      const markText = markMatch[1].trim();
      if (markText.length > 2) return markText;
    }

    // Look for background-color style (another form of highlighting)
    const bgMatch = html.match(/style="[^"]*background-color[^"]*"[^>]*>([^<]+)</);
    if (bgMatch) {
      const bgText = bgMatch[1].trim();
      if (bgText.length > 2) return bgText;
    }
  }

  return null;
}

/**
 * Map text (LO description or question text) to a standard category.
 */
function categorizeFromText(text: string): string | null {
  for (const { category, patterns } of CATEGORY_KEYWORDS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return category;
    }
  }
  return null;
}
