// Common Intermediate Representation (CIR) types
// All source parsers output ParsedActivityData, decoupling parsing from storage.

export type DataSource = "array" | "globalmeet" | "pigeonhole" | "snowflake_eval" | "snowflake_ondemand";

export type QuestionType = "assessment" | "confidence" | "evaluation" | "pulse" | "ars";

export interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  questionType: QuestionType;
  questionCategory?: string;
  correctAnswer?: string;
  /** For evaluation questions */
  evalCategory?: "practice_profile" | "intended_change" | "barrier" | "demographic" | "custom" | "faculty_rating" | "overall_rating" | "learning_objective_rating";
  /** Faculty name for faculty rating questions */
  facultyName?: string;
}

export interface ParsedLearnerResponse {
  questionNumber: number;
  phase: "pre" | "post";
  learnerAnswer: string | null;
  isCorrect: boolean | null;
  numericValue: number | null;
}

export interface ParsedEvaluationResponse {
  questionNumber: number;
  questionText: string;
  evalCategory: "practice_profile" | "intended_change" | "barrier" | "demographic" | "custom" | "faculty_rating" | "overall_rating" | "learning_objective_rating";
  responseText: string | null;
  responseNumeric: number | null;
  facultyName?: string;
}

export interface ParsedPresenterResponse {
  questionNumber: number;
  questionText: string;
  responseText: string | null;
}

export interface ParsedLearner {
  email: string;
  firstName: string | null;
  lastName: string | null;
  employer: string | null;
  practiceSetting: string | null;
  role: string | null;
  /** Additional demographic fields (phone, state, zip, etc.) */
  demographics: Record<string, string | null>;
  /** Per-question responses (assessment + confidence) */
  responses: ParsedLearnerResponse[];
  /** Evaluation responses (Type 2 / Type 3) */
  evaluationResponses: ParsedEvaluationResponse[];
  /** Presenter Q&A responses */
  presenterResponses: ParsedPresenterResponse[];
  /** Computed aggregate scores */
  preScore: number | null;
  postScore: number | null;
  scoreChange: number | null;
  preConfidenceAvg: number | null;
  postConfidenceAvg: number | null;
  confidenceChange: number | null;
  comments: string | null;
}

export interface ParseWarning {
  type: "exclusion" | "data_quality" | "missing_data" | "format";
  message: string;
  /** Row number or learner email for context */
  context?: string;
}

export interface ParsedActivityData {
  source: DataSource;
  sourceFileName: string;
  /** Suggested activity name extracted from the file */
  suggestedActivityName: string | null;
  /** Parsed questions with metadata */
  questions: ParsedQuestion[];
  /** Parsed learner data with all responses */
  learners: ParsedLearner[];
  /** Warnings generated during parsing */
  warnings: ParseWarning[];
  /** Learners excluded (e.g., duration filter) */
  excludedCount: number;
  /** Raw metadata from the file (event title, dates, etc.) */
  metadata: Record<string, string>;
}

/** Answer key entry — maps question text or number to the correct answer */
export interface AnswerKeyEntry {
  questionNumber?: number;
  questionText?: string;
  correctAnswer: string;
  questionCategory?: string;
  questionType?: QuestionType;
}

/** Result of source auto-detection */
export interface DetectionResult {
  source: DataSource;
  confidence: "high" | "medium" | "low";
  signals: string[];
}
