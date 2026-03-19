export { detectSource } from "./detect-source";
export { parseArrayFile } from "./array-parser";
export { parseGlobalMeetFile, mergeGlobalMeetFiles } from "./globalmeet-parser";
export { parsePigeonholeFiles } from "./pigeonhole-parser";
export { parseSnowflakeEvalFile } from "./snowflake-eval-parser";
export { parseSnowflakeOnDemandFile } from "./snowflake-ondemand-parser";
export { extractAnswerKeyFromHighlighting, applyAnswerKey } from "./answer-key";
export { mergeSources, classifyFileRole, formatSourceLabel } from "./merge-sources";
export { likertToNumeric, confidenceBinary, confidenceChange, confidenceAverage, computeAssessmentScore } from "./confidence-scorer";
export type {
  DataSource,
  QuestionType,
  ParsedActivityData,
  ParsedLearner,
  ParsedQuestion,
  ParsedLearnerResponse,
  ParsedEvaluationResponse,
  ParsedPresenterResponse,
  ParseWarning,
  AnswerKeyEntry,
  DetectionResult,
  DetectedFile,
  FileRole,
  MergeResult,
  SourceBreakdown,
} from "./types";
