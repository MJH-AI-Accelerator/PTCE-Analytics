import type { ParsedActivityData, MergeResult, ParsedQuestion } from "@/lib/parsers/types";

// ── Result types ──

export interface QuestionPerformance {
  questionNumber: number;
  questionText: string;
  questionCategory: string | null;
  preCorrectPct: number | null;
  postCorrectPct: number | null;
  changePct: number | null;
  preRespondents: number;
  postRespondents: number;
}

export interface ConfidenceSummary {
  preAvg: number | null;
  postAvg: number | null;
  change: number | null;
  respondents: number;
}

export interface CategoryPerformance {
  category: string;
  preCorrectPct: number;
  postCorrectPct: number;
  changePct: number;
  questionCount: number;
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
  // Learner count: those with assessment responses (Array source)
  const learnersWithAssessment = learners.filter(
    (l) => l.responses.length > 0 || l.preScore != null || l.postScore != null
  );
  const learnersWithEval = learners.filter(
    (l) => l.evaluationResponses.length > 0
  );

  const learnerCount = learnersWithAssessment.length;
  const completerCount = learnersWithEval.length;
  const matchedCount = mergeResult?.matchedCount ?? Math.min(learnerCount, completerCount);
  const questionsCreated = dbResult.questionsCreated || questions.filter((q) => q.questionType === "assessment").length;

  // ── Per-question pre vs post performance ──
  const assessmentQuestions = questions.filter((q) => q.questionType === "assessment");
  const questionPerformance = computeQuestionPerformance(assessmentQuestions, learners);

  // ── Confidence summary ──
  const confidence = computeConfidenceSummary(learners);

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
  const barriers = computeEvalFrequency(learners, "barrier");

  // ── Overall score summary ──
  const preScores = learners.map((l) => l.preScore).filter((s): s is number => s != null);
  const postScores = learners.map((l) => l.postScore).filter((s): s is number => s != null);
  const avgPreScore = preScores.length > 0 ? avg(preScores) : null;
  const avgPostScore = postScores.length > 0 ? avg(postScores) : null;
  const avgScoreChange = avgPreScore != null && avgPostScore != null ? avgPostScore - avgPreScore : null;

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

    const prePct = preTotal > 0 ? pct(preCorrect, preTotal) : null;
    const postPct = postTotal > 0 ? pct(postCorrect, postTotal) : null;
    const changePct = prePct != null && postPct != null ? Math.round((postPct - prePct) * 10) / 10 : null;

    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionCategory: q.questionCategory ?? null,
      preCorrectPct: prePct,
      postCorrectPct: postPct,
      changePct,
      preRespondents: preTotal,
      postRespondents: postTotal,
    };
  });
}

function computeConfidenceSummary(
  learners: ParsedActivityData["learners"]
): ConfidenceSummary {
  const preVals = learners.map((l) => l.preConfidenceAvg).filter((v): v is number => v != null);
  const postVals = learners.map((l) => l.postConfidenceAvg).filter((v): v is number => v != null);
  const respondents = Math.max(preVals.length, postVals.length);

  const preAvg = preVals.length > 0 ? Math.round(avg(preVals) * 100) / 100 : null;
  const postAvg = postVals.length > 0 ? Math.round(avg(postVals) * 100) / 100 : null;
  const change = preAvg != null && postAvg != null ? Math.round((postAvg - preAvg) * 100) / 100 : null;

  return { preAvg, postAvg, change, respondents };
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
      });
    }
  }

  return results.sort((a, b) => a.postCorrectPct - b.postCorrectPct);
}

function computePracticeSettings(
  learners: ParsedActivityData["learners"]
): PracticeSettingBreakdown[] {
  const counts = new Map<string, number>();
  for (const l of learners) {
    const setting = l.practiceSetting ?? "Unknown";
    counts.set(setting, (counts.get(setting) ?? 0) + 1);
  }

  const total = learners.length;
  return Array.from(counts.entries())
    .map(([setting, count]) => ({
      setting,
      count,
      pct: pct(count, total),
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
