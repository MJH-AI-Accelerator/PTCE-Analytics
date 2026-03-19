import type { ParsedActivityData, MergeResult, ParsedQuestion } from "@/lib/parsers/types";

const NO_BARRIER_PATTERN = /do not anticipate|no barriers|none/i;

// ── Result types ──

export interface QuestionPerformance {
  questionNumber: number;
  questionText: string;
  questionCategory: string | null;
  correctAnswer: string | null;
  preCorrectPct: number | null;
  postCorrectPct: number | null;
  changePct: number | null;
  preRespondents: number;
  postRespondents: number;
}

export interface ConfidenceSummary {
  /** % of pre-test respondents who chose Moderately/Very/Extremely (3-5) */
  preHighPct: number | null;
  /** % of post-test respondents who chose Moderately/Very/Extremely (3-5) */
  postHighPct: number | null;
  /** Percentage point change from pre to post */
  changePct: number | null;
  /** % of learners who moved from Not at all/Somewhat (1-2) on pre to Moderately/Very/Extremely (3-5) on post */
  improvedPct: number | null;
  /** Count of learners who improved */
  improvedCount: number;
  preRespondents: number;
  postRespondents: number;
}

export interface CategoryPerformance {
  category: string;
  preCorrectPct: number;
  postCorrectPct: number;
  changePct: number;
  questionCount: number;
  /** Question numbers in this category (e.g., [1, 3]) */
  questionNumbers: number[];
}

export interface PracticeSettingBreakdown {
  setting: string;
  count: number;
  pct: number;
}

export interface EmployerBreakdown {
  employer: string;
  count: number;
}

export interface FrequencyItem {
  text: string;
  count: number;
}

export interface ImportSummary {
  // Primary metrics
  learnerCount: number;         // unique emails from assessment source (Array)
  completerCount: number;       // unique emails from evaluation source (Snowflake eval)
  matchedCount: number;         // emails matched across both sources
  questionsCreated: number;     // total assessment questions

  // Per-question pre vs post
  questionPerformance: QuestionPerformance[];

  // Confidence
  confidence: ConfidenceSummary;

  // Category / learning objective analysis
  categoryPerformance: CategoryPerformance[];
  weakestCategory: string | null;

  // Practice setting breakdown
  practiceSettings: PracticeSettingBreakdown[];

  // Top employers
  topEmployers: EmployerBreakdown[];

  // Presenter questions
  presenterQuestionCount: number;

  // Evaluation insights
  intendedChanges: FrequencyItem[];
  barriers: FrequencyItem[];
  /** "I do not anticipate any barriers" — separated for display at the bottom */
  noBarrierItem: FrequencyItem | null;

  // Overall score summary
  avgPreScore: number | null;
  avgPostScore: number | null;
  avgScoreChange: number | null;
}

// ── Computation ──

export function computeImportSummary(
  parsed: ParsedActivityData,
  mergeResult: MergeResult | null,
  dbResult: { questionsCreated: number }
): ImportSummary {
  const learners = parsed.learners;
  const questions = parsed.questions;

  // ── Primary metrics ──
  // Learner count: emails from assessment source (Array report) only
  // When merged, total learners includes eval-only learners — subtract them
  const evalOnlyCount = mergeResult?.evalOnlyCount ?? 0;
  const learnerCount = learners.length - evalOnlyCount;

  const learnersWithEval = learners.filter(
    (l) => l.evaluationResponses.length > 0
  );
  const completerCount = learnersWithEval.length;
  const matchedCount = mergeResult?.matchedCount ?? Math.min(learnerCount, completerCount);
  const questionsCreated = dbResult.questionsCreated || questions.filter((q) => q.questionType === "assessment").length;

  // ── Per-question pre vs post performance ──
  const assessmentQuestions = questions.filter((q) => q.questionType === "assessment");
  const questionPerformance = computeQuestionPerformance(assessmentQuestions, learners);

  // ── Confidence summary ──
  const confidenceQNums = new Set(
    questions.filter((q) => q.questionType === "confidence").map((q) => q.questionNumber)
  );
  const confidence = computeConfidenceSummary(learners, confidenceQNums);

  // ── Category performance ──
  const categoryPerformance = computeCategoryPerformance(assessmentQuestions, learners);
  const weakestCategory = categoryPerformance.length > 0
    ? categoryPerformance.reduce((worst, c) =>
        c.postCorrectPct < worst.postCorrectPct ? c : worst
      ).category
    : null;

  // ── Practice settings ──
  const practiceSettings = computePracticeSettings(learners);

  // ── Top employers ──
  const topEmployers = computeTopEmployers(learners);

  // ── Presenter questions ──
  const presenterQuestionCount = new Set(
    learners.flatMap((l) => l.presenterResponses.map((r) => r.questionNumber))
  ).size;

  // ── Evaluation insights ──
  const intendedChanges = computeEvalFrequency(learners, "intended_change");
  const allBarrierItems = computeEvalFrequency(learners, "barrier");
  const noBarrierItem = allBarrierItems.find((i) => NO_BARRIER_PATTERN.test(i.text)) ?? null;
  const barriers = allBarrierItems.filter((i) => !NO_BARRIER_PATTERN.test(i.text));

  // ── Overall score summary (2 decimal places) ──
  const preScores = learners.map((l) => l.preScore).filter((s): s is number => s != null);
  const postScores = learners.map((l) => l.postScore).filter((s): s is number => s != null);
  const avgPreScore = preScores.length > 0 ? Math.round(avg(preScores) * 100) / 100 : null;
  const avgPostScore = postScores.length > 0 ? Math.round(avg(postScores) * 100) / 100 : null;
  const avgScoreChange = avgPreScore != null && avgPostScore != null
    ? Math.round((avgPostScore - avgPreScore) * 100) / 100
    : null;

  return {
    learnerCount,
    completerCount,
    matchedCount,
    questionsCreated,
    questionPerformance,
    confidence,
    categoryPerformance,
    weakestCategory,
    practiceSettings,
    topEmployers,
    presenterQuestionCount,
    intendedChanges,
    barriers,
    noBarrierItem,
    avgPreScore,
    avgPostScore,
    avgScoreChange,
  };
}

// ── Helpers ──

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

function computeQuestionPerformance(
  questions: ParsedQuestion[],
  learners: ParsedActivityData["learners"]
): QuestionPerformance[] {
  return questions.map((q) => {
    let preCorrect = 0, preTotal = 0, postCorrect = 0, postTotal = 0;

    for (const learner of learners) {
      for (const r of learner.responses) {
        if (r.questionNumber !== q.questionNumber) continue;
        if (r.isCorrect == null) continue;
        if (r.phase === "pre") {
          preTotal++;
          if (r.isCorrect) preCorrect++;
        } else {
          postTotal++;
          if (r.isCorrect) postCorrect++;
        }
      }
    }

    const prePct = preTotal > 0 ? Math.round((preCorrect / preTotal) * 100) : null;
    const postPct = postTotal > 0 ? Math.round((postCorrect / postTotal) * 100) : null;
    const changePct = prePct != null && postPct != null ? postPct - prePct : null;

    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionCategory: q.questionCategory ?? null,
      correctAnswer: q.correctAnswer ?? null,
      preCorrectPct: prePct,
      postCorrectPct: postPct,
      changePct,
      preRespondents: preTotal,
      postRespondents: postTotal,
    };
  });
}

function computeConfidenceSummary(
  learners: ParsedActivityData["learners"],
  confidenceQNums: Set<number>
): ConfidenceSummary {
  // "High confidence" = Moderately (3), Very (4), Extremely (5)
  // "Low confidence" = Not at all (1), Somewhat (2)
  let preHighCount = 0;
  let preTotal = 0;
  let postHighCount = 0;
  let postTotal = 0;
  let improvedCount = 0;
  let learnersWithBoth = 0;

  for (const learner of learners) {
    const preValues: number[] = [];
    const postValues: number[] = [];

    // Collect confidence responses only (filter by confidence question numbers)
    for (const r of learner.responses) {
      if (r.numericValue == null) continue;
      if (confidenceQNums.size > 0 && !confidenceQNums.has(r.questionNumber)) continue;
      if (r.phase === "pre") preValues.push(r.numericValue);
      else postValues.push(r.numericValue);
    }

    // Fall back to aggregate scores if no individual responses
    if (preValues.length === 0 && learner.preConfidenceAvg != null) {
      preValues.push(learner.preConfidenceAvg);
    }
    if (postValues.length === 0 && learner.postConfidenceAvg != null) {
      postValues.push(learner.postConfidenceAvg);
    }

    const preAvg = preValues.length > 0 ? avg(preValues) : null;
    const postAvg = postValues.length > 0 ? avg(postValues) : null;

    if (preAvg != null) {
      preTotal++;
      if (preAvg >= 3) preHighCount++;
    }
    if (postAvg != null) {
      postTotal++;
      if (postAvg >= 3) postHighCount++;
    }

    // Track improvement: low pre (1-2) → high post (3-5)
    if (preAvg != null && postAvg != null) {
      learnersWithBoth++;
      if (preAvg < 3 && postAvg >= 3) {
        improvedCount++;
      }
    }
  }

  const preHighPct = preTotal > 0 ? pct(preHighCount, preTotal) : null;
  const postHighPct = postTotal > 0 ? pct(postHighCount, postTotal) : null;
  const changePct = preHighPct != null && postHighPct != null
    ? Math.round((postHighPct - preHighPct) * 10) / 10
    : null;
  const improvedPct = learnersWithBoth > 0 ? pct(improvedCount, learnersWithBoth) : null;

  return {
    preHighPct,
    postHighPct,
    changePct,
    improvedPct,
    improvedCount,
    preRespondents: preTotal,
    postRespondents: postTotal,
  };
}

function computeCategoryPerformance(
  questions: ParsedQuestion[],
  learners: ParsedActivityData["learners"]
): CategoryPerformance[] {
  // Group questions by category
  const categoryMap = new Map<string, number[]>();
  for (const q of questions) {
    const cat = q.questionCategory;
    if (!cat) continue;
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(q.questionNumber);
  }

  const results: CategoryPerformance[] = [];
  for (const [category, qNums] of categoryMap) {
    let preCorrect = 0, preTotal = 0, postCorrect = 0, postTotal = 0;

    for (const learner of learners) {
      for (const r of learner.responses) {
        if (!qNums.includes(r.questionNumber)) continue;
        if (r.isCorrect == null) continue;
        if (r.phase === "pre") {
          preTotal++;
          if (r.isCorrect) preCorrect++;
        } else {
          postTotal++;
          if (r.isCorrect) postCorrect++;
        }
      }
    }

    if (preTotal > 0 || postTotal > 0) {
      const prePctVal = pct(preCorrect, preTotal);
      const postPctVal = pct(postCorrect, postTotal);
      results.push({
        category,
        preCorrectPct: prePctVal,
        postCorrectPct: postPctVal,
        changePct: Math.round((postPctVal - prePctVal) * 10) / 10,
        questionCount: qNums.length,
        questionNumbers: qNums.sort((a, b) => a - b),
      });
    }
  }

  return results.sort((a, b) => a.postCorrectPct - b.postCorrectPct);
}

function computePracticeSettings(
  learners: ParsedActivityData["learners"]
): PracticeSettingBreakdown[] {
  const counts = new Map<string, number>();
  let knownTotal = 0;
  for (const l of learners) {
    const setting = l.practiceSetting;
    if (!setting) continue; // skip unknown/null
    counts.set(setting, (counts.get(setting) ?? 0) + 1);
    knownTotal++;
  }

  return Array.from(counts.entries())
    .map(([setting, count]) => ({
      setting,
      count,
      pct: pct(count, knownTotal),
    }))
    .sort((a, b) => b.count - a.count);
}

function computeTopEmployers(
  learners: ParsedActivityData["learners"]
): EmployerBreakdown[] {
  const counts = new Map<string, number>();
  for (const l of learners) {
    const employer = l.employer ?? "Unknown";
    counts.set(employer, (counts.get(employer) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([employer, count]) => ({ employer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computeEvalFrequency(
  learners: ParsedActivityData["learners"],
  evalCategory: string
): FrequencyItem[] {
  const counts = new Map<string, number>();

  for (const l of learners) {
    for (const er of l.evaluationResponses) {
      if (er.evalCategory !== evalCategory) continue;
      const text = er.responseText?.trim();
      if (!text) continue;
      // Split multi-select responses (semicolon-separated)
      const parts = text.includes(";") ? text.split(";").map((s) => s.trim()) : [text];
      for (const part of parts) {
        if (part) counts.set(part, (counts.get(part) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
